import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppSessionEntity } from '../../database/entities/app-session.entity';
import { AppUserEntity } from '../../database/entities/app-user.entity';
import { UserGoogleAdsAccountAccessEntity } from '../../database/entities/user-google-ads-account-access.entity';
import { WorkspaceMemberEntity } from '../../database/entities/workspace-member.entity';
import { AUTH_COOKIE_NAME, getCookieValue } from './auth.cookies';
import {
  getRolePermissions,
  hasPermission,
  normalizeRole,
  type AppRole,
  type Permission,
} from './auth.permissions';
import { hashSessionToken } from './password';
import { PERMISSIONS_KEY } from './permissions.decorator';

export type AuthenticatedUser = {
  id: string;
  email: string;
  displayName: string;
  status: string;
  workspaceId: string;
  role: AppRole;
  permissions: Permission[];
  accountAccess: Array<{
    customerId: string;
  }>;
};

type RequestWithUser = {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthenticatedUser;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly dataSource: DataSource,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = getCookieValue(request.headers.cookie, AUTH_COOKIE_NAME);
    if (!token) {
      throw new UnauthorizedException('Please sign in to continue');
    }

    const tokenHash = hashSessionToken(token);
    const session = await this.dataSource
      .getRepository(AppSessionEntity)
      .findOneBy({ tokenHash });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Your session has expired');
    }

    const user = await this.dataSource
      .getRepository(AppUserEntity)
      .findOneBy({ id: session.userId });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('This user is not active');
    }

    const member = await this.dataSource
      .getRepository(WorkspaceMemberEntity)
      .findOne({
        where: { userId: user.id },
        order: { createdAt: 'ASC' },
      });

    if (!member) {
      throw new ForbiddenException('This user is not assigned to a workspace');
    }

    const role = normalizeRole(member.role);
    const accountAccess = await this.dataSource
      .getRepository(UserGoogleAdsAccountAccessEntity)
      .findBy({ userId: user.id });
    const authUser: AuthenticatedUser = {
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
    request.user = authUser;

    const requiredPermissions =
      this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    const isAllowed = requiredPermissions.every((permission) =>
      hasPermission(role, permission),
    );

    if (!isAllowed) {
      throw new ForbiddenException('You do not have permission for this action');
    }

    return true;
  }
}
