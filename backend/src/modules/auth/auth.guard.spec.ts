import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { hashSessionToken } from './password';

function dataSourceWith(values: Record<string, any>) {
  return {
    getRepository(entity: { name: string }) {
      const value = values[entity.name];
      return {
        findOneBy: async () => value,
        findOne: async () => value,
        findBy: async () => value ?? [],
      };
    },
  };
}

function context(cookie: string | undefined) {
  const request = { headers: { cookie } } as any;
  return {
    request,
    value: {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => null,
      getClass: () => null,
    },
  };
}

test('auth guard rejects missing, expired, and revoked sessions', async () => {
  const reflector = { getAllAndOverride: () => [] } as any;
  const missing = new AuthGuard(dataSourceWith({}) as any, reflector);
  await assert.rejects(() => missing.canActivate(context(undefined).value as any), UnauthorizedException);

  for (const session of [
    { userId: 'u1', revokedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) },
    { userId: 'u1', revokedAt: null, expiresAt: new Date(Date.now() - 60_000) },
  ]) {
    const guard = new AuthGuard(dataSourceWith({ AppSessionEntity: session }) as any, reflector);
    await assert.rejects(
      () => guard.canActivate(context('ggads_session=token').value as any),
      UnauthorizedException,
    );
  }
});

test('auth guard attaches user and enforces route permission', async () => {
  const values = {
    AppSessionEntity: {
      userId: 'u1',
      tokenHash: hashSessionToken('token'),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    },
    AppUserEntity: { id: 'u1', email: 'a@b.test', displayName: 'A', status: 'ACTIVE' },
    WorkspaceMemberEntity: { userId: 'u1', workspaceId: 'w1', role: 'VIEWER' },
    UserGoogleAdsAccountAccessEntity: [{ userId: 'u1', customerId: '1234567890' }],
  };
  const allowed = new AuthGuard(
    dataSourceWith(values) as any,
    { getAllAndOverride: () => ['ads.view'] } as any,
  );
  const allowedContext = context('x=1; ggads_session=token');
  assert.equal(await allowed.canActivate(allowedContext.value as any), true);
  assert.equal(allowedContext.request.user.role, 'VIEWER');
  assert.deepEqual(allowedContext.request.user.accountAccess, [{ customerId: '1234567890' }]);

  const denied = new AuthGuard(
    dataSourceWith(values) as any,
    { getAllAndOverride: () => ['users.manage'] } as any,
  );
  await assert.rejects(
    () => denied.canActivate(context('ggads_session=token').value as any),
    ForbiddenException,
  );
});
