import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AppSessionEntity } from '../../database/entities/app-session.entity';
import { AppUserEntity } from '../../database/entities/app-user.entity';
import { UserGoogleAdsAccountAccessEntity } from '../../database/entities/user-google-ads-account-access.entity';
import { WorkspaceMemberEntity } from '../../database/entities/workspace-member.entity';
import { WorkspaceEntity } from '../workspaces/entities/workspace.entity';
import { AUTH_COOKIE_NAME, getClientIp, getCookieValue } from './auth.cookies';
import {
  getRolePermissions,
  normalizeRole,
  type AppRole,
} from './auth.permissions';
import {
  getPasswordPolicyError,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from './password';
import type { AuthenticatedUser } from './auth.guard';

type LoginInput = {
  email?: string;
  password?: string;
};

type CreateUserInput = {
  email?: string;
  displayName?: string;
  password?: string;
  role?: string;
  status?: string;
};

type UpdateUserInput = Partial<CreateUserInput>;

type AccountAccessInput = {
  customerId?: string;
  allowed?: boolean;
};

type RequestLike = {
  headers: Record<string, string | string[] | undefined>;
};

type ResponseLike = {
  cookie?: (name: string, value: string, options: Record<string, unknown>) => void;
  clearCookie?: (name: string, options: Record<string, unknown>) => void;
  setHeader?: (name: string, value: string | string[]) => void;
};

@Injectable()
export class AuthService {
  constructor(private readonly dataSource: DataSource) {}

  async login(input: LoginInput, request: RequestLike, response: ResponseLike) {
    const email = this.normalizeEmail(input.email);
    const password = String(input.password ?? '');
    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    const userRepository = this.dataSource.getRepository(AppUserEntity);
    const user = await userRepository.findOneBy({ email });
    if (!user || user.status !== 'ACTIVE' || !verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const member = await this.findUserMembership(user.id);
    if (!member) {
      throw new UnauthorizedException('This user is not assigned to a workspace');
    }

    const token = randomBytes(32).toString('base64url');
    const expiresAt = this.getSessionExpiry();
    await this.dataSource.getRepository(AppSessionEntity).save(
      this.dataSource.getRepository(AppSessionEntity).create({
        userId: user.id,
        tokenHash: hashSessionToken(token),
        expiresAt,
        revokedAt: null,
        userAgent: this.getHeader(request.headers, 'user-agent'),
        ipAddress: getClientIp(request.headers),
      }),
    );

    user.lastLoginAt = new Date();
    await userRepository.save(user);
    this.setSessionCookie(response, token, expiresAt);

    return { user: await this.serializeUser(user, member) };
  }

  async logout(request: RequestLike, response: ResponseLike) {
    const token = getCookieValue(request.headers.cookie, AUTH_COOKIE_NAME);
    if (token) {
      const sessionRepository = this.dataSource.getRepository(AppSessionEntity);
      const session = await sessionRepository.findOneBy({
        tokenHash: hashSessionToken(token),
      });
      if (session && !session.revokedAt) {
        session.revokedAt = new Date();
        await sessionRepository.save(session);
      }
    }

    this.clearSessionCookie(response);
    return { ok: true };
  }

  me(user: AuthenticatedUser) {
    return { user };
  }

  async listUsers() {
    const users = await this.dataSource.getRepository(AppUserEntity).find({
      order: { createdAt: 'ASC' },
    });
    const members = await this.dataSource.getRepository(WorkspaceMemberEntity).find();
    const membershipByUserId = new Map(members.map((member) => [member.userId, member]));
    const accountAccess = await this.dataSource
      .getRepository(UserGoogleAdsAccountAccessEntity)
      .find();
    const accessByUserId = new Map<string, UserGoogleAdsAccountAccessEntity[]>();
    for (const access of accountAccess) {
      accessByUserId.set(access.userId, [
        ...(accessByUserId.get(access.userId) ?? []),
        access,
      ]);
    }

    return {
      users: users.map((user) => {
        const member = membershipByUserId.get(user.id);
        const access = accessByUserId.get(user.id) ?? [];
        return {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          status: user.status,
          workspaceId: member?.workspaceId ?? null,
          role: normalizeRole(member?.role),
          accountAccess: access.map((item) => ({
            customerId: item.customerId,
          })),
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        };
      }),
    };
  }

  async createUser(input: CreateUserInput) {
    const email = this.normalizeEmail(input.email);
    const displayName = String(input.displayName ?? '').trim();
    const password = String(input.password ?? '');
    const role = normalizeRole(input.role);

    if (!email || !displayName || !password) {
      throw new BadRequestException('Email, display name, and password are required');
    }
    this.assertStrongPassword(password);

    const workspace = await this.getDefaultWorkspace();
    const userRepository = this.dataSource.getRepository(AppUserEntity);
    const existing = await userRepository.findOneBy({ email });
    if (existing) {
      throw new BadRequestException('A user with this email already exists');
    }

    const user = await userRepository.save(
      userRepository.create({
        email,
        displayName,
        passwordHash: hashPassword(password),
        status: this.normalizeStatus(input.status),
        lastLoginAt: null,
      }),
    );

    await this.dataSource.getRepository(WorkspaceMemberEntity).save({
      workspaceId: workspace.id,
      userId: user.id,
      role,
    });

    return { user: await this.serializeUser(user, { workspaceId: workspace.id, role }) };
  }

  async updateUser(id: string, input: UpdateUserInput, actingUserId?: string) {
    const userRepository = this.dataSource.getRepository(AppUserEntity);
    const user = await userRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const nextEmail = input.email === undefined ? user.email : this.normalizeEmail(input.email);
    const nextDisplayName =
      input.displayName === undefined
        ? user.displayName
        : String(input.displayName ?? '').trim();

    if (!nextEmail || !nextDisplayName) {
      throw new BadRequestException('Email and display name are required');
    }

    const member = await this.findUserMembership(user.id);
    const currentRole = normalizeRole(member?.role);
    const nextRole = input.role === undefined ? currentRole : normalizeRole(input.role);
    const nextStatus = this.normalizeStatus(input.status ?? user.status);
    if (actingUserId === id && (nextRole !== currentRole || nextStatus !== user.status)) {
      throw new BadRequestException('You cannot change your own role or status');
    }
    if (
      currentRole === 'ADMIN' &&
      user.status === 'ACTIVE' &&
      (nextRole !== 'ADMIN' || nextStatus !== 'ACTIVE')
    ) {
      await this.assertAnotherActiveAdmin(user.id);
    }
    if (input.password) this.assertStrongPassword(input.password);

    user.email = nextEmail;
    user.displayName = nextDisplayName;
    user.status = nextStatus;
    const passwordChanged = Boolean(input.password);
    if (input.password) {
      user.passwordHash = hashPassword(input.password);
    }

    const savedUser = await userRepository.save(user);
    let savedMember = member;
    if (!savedMember) {
      const workspace = await this.getDefaultWorkspace();
      savedMember = await this.dataSource.getRepository(WorkspaceMemberEntity).save({
        workspaceId: workspace.id,
        userId: savedUser.id,
        role: normalizeRole(input.role),
      });
    } else if (input.role) {
      savedMember.role = nextRole;
      savedMember = await this.dataSource.getRepository(WorkspaceMemberEntity).save(savedMember);
    }

    if (passwordChanged) await this.revokeUserSessions(savedUser.id);

    return { user: await this.serializeUser(savedUser, savedMember) };
  }

  async setUserAccountAccess(
    userId: string,
    input: AccountAccessInput,
    grantedByUserId?: string,
  ) {
    const targetUser = await this.dataSource
      .getRepository(AppUserEntity)
      .findOneBy({ id: userId });
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const customerId = String(input.customerId ?? '').replace(/\D/g, '');
    if (!/^\d{10}$/.test(customerId)) {
      throw new BadRequestException('customerId must be a 10 digit Google Ads customer ID');
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(UserGoogleAdsAccountAccessEntity).delete({
        userId,
        customerId,
      });

      if (input.allowed === true) {
        await manager.getRepository(UserGoogleAdsAccountAccessEntity).save({
          userId,
          customerId,
          grantedBy: grantedByUserId ?? null,
        });
      }
    });

    return this.listUsers();
  }

  private normalizeEmail(value: unknown) {
    return String(value ?? '').trim().toLowerCase();
  }

  private normalizeStatus(value: unknown) {
    const status = String(value ?? 'ACTIVE').trim().toUpperCase();
    return status === 'DISABLED' ? 'DISABLED' : 'ACTIVE';
  }

  private assertStrongPassword(password: string) {
    const error = getPasswordPolicyError(password);
    if (error) throw new BadRequestException(error);
  }

  private async revokeUserSessions(userId: string) {
    await this.dataSource
      .getRepository(AppSessionEntity)
      .createQueryBuilder()
      .update()
      .set({ revokedAt: new Date() })
      .where('user_id = :userId', { userId })
      .andWhere('revoked_at IS NULL')
      .execute();
  }

  private async assertAnotherActiveAdmin(excludedUserId: string) {
    const activeUsers = await this.dataSource
      .getRepository(AppUserEntity)
      .findBy({ status: 'ACTIVE' });
    const memberships = await this.dataSource
      .getRepository(WorkspaceMemberEntity)
      .findBy({ role: 'ADMIN' });
    const activeUserIds = new Set(activeUsers.map((item) => item.id));
    const hasAnotherAdmin = memberships.some(
      (item) => item.userId !== excludedUserId && activeUserIds.has(item.userId),
    );
    if (!hasAnotherAdmin) {
      throw new BadRequestException('At least one active admin is required');
    }
  }

  private async findUserMembership(userId: string) {
    return this.dataSource.getRepository(WorkspaceMemberEntity).findOne({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
  }

  private async getDefaultWorkspace() {
    const workspace = await this.dataSource
      .getRepository(WorkspaceEntity)
      .findOneBy({ slug: 'allsoft' });
    if (!workspace) {
      throw new NotFoundException('Default workspace was not seeded');
    }
    return workspace;
  }

  private async serializeUser(
    user: AppUserEntity,
    member: { workspaceId: string; role: string },
  ) {
    const role = normalizeRole(member.role);
    const accountAccess = await this.dataSource
      .getRepository(UserGoogleAdsAccountAccessEntity)
      .findBy({ userId: user.id });
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      status: user.status,
      workspaceId: member.workspaceId,
      role,
      permissions: getRolePermissions(role),
      accountAccess: accountAccess.map((item) => ({
        customerId: item.customerId,
      })),
    };
  }

  private getSessionExpiry() {
    const days = Math.max(1, Number(process.env.AUTH_SESSION_DAYS ?? 7));
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private setSessionCookie(response: ResponseLike, token: string, expiresAt: Date) {
    const options = {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.AUTH_COOKIE_SECURE === 'true',
      path: '/',
      expires: expiresAt,
      maxAge: expiresAt.getTime() - Date.now(),
    };

    if (response.cookie) {
      response.cookie(AUTH_COOKIE_NAME, token, options);
      return;
    }

    response.setHeader?.('Set-Cookie', this.cookieHeader(AUTH_COOKIE_NAME, token, options));
  }

  private clearSessionCookie(response: ResponseLike) {
    const options = {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.AUTH_COOKIE_SECURE === 'true',
      path: '/',
      expires: new Date(0),
      maxAge: 0,
    };

    if (response.clearCookie) {
      response.clearCookie(AUTH_COOKIE_NAME, options);
      return;
    }

    response.setHeader?.('Set-Cookie', this.cookieHeader(AUTH_COOKIE_NAME, '', options));
  }

  private cookieHeader(
    name: string,
    value: string,
    options: Record<string, unknown>,
  ) {
    const parts = [`${name}=${encodeURIComponent(value)}`, 'HttpOnly', 'Path=/'];
    if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
    if (options.secure) parts.push('Secure');
    if (options.expires instanceof Date) parts.push(`Expires=${options.expires.toUTCString()}`);
    if (typeof options.maxAge === 'number') parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
    return parts.join('; ');
  }

  private getHeader(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ) {
    const value = headers[name];
    return Array.isArray(value) ? value.join(', ') : value ?? null;
  }
}
