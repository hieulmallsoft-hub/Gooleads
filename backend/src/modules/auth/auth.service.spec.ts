import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { hashPassword, verifyPassword } from './password';

function createService(currentPassword = 'Current@123') {
  const user = {
    id: 'user-1',
    email: 'admin@allsoft.local',
    displayName: 'Admin',
    status: 'ACTIVE',
    passwordHash: hashPassword(currentPassword),
  };
  let sessionsRevoked = false;
  const queryBuilder = {
    update() {
      return this;
    },
    set() {
      sessionsRevoked = true;
      return this;
    },
    where() {
      return this;
    },
    andWhere() {
      return this;
    },
    async execute() {
      return { affected: 2 };
    },
  };
  const dataSource = {
    getRepository(entity: { name: string }) {
      if (entity.name === 'AppUserEntity') {
        return {
          findOneBy: async ({ id }: { id: string }) =>
            id === user.id ? user : null,
          save: async (value: typeof user) => value,
        };
      }
      return {
        createQueryBuilder: () => queryBuilder,
      };
    },
  };

  return {
    service: new AuthService(dataSource as any),
    user,
    sessionsWereRevoked: () => sessionsRevoked,
  };
}

test('user can change password and all sessions are revoked', async () => {
  const { service, user, sessionsWereRevoked } = createService();
  let clearedCookie = '';

  const result = await service.changePassword(
    user.id,
    {
      currentPassword: 'Current@123',
      newPassword: 'NewPassword@456',
      confirmPassword: 'NewPassword@456',
    },
    {
      clearCookie: (name) => {
        clearedCookie = name;
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(verifyPassword('NewPassword@456', user.passwordHash), true);
  assert.equal(sessionsWereRevoked(), true);
  assert.equal(clearedCookie, 'ggads_session');
});

test('change password rejects an incorrect current password', async () => {
  const { service, user, sessionsWereRevoked } = createService();

  await assert.rejects(
    () =>
      service.changePassword(
        user.id,
        {
          currentPassword: 'WrongPassword@123',
          newPassword: 'NewPassword@456',
          confirmPassword: 'NewPassword@456',
        },
        {},
      ),
    UnauthorizedException,
  );

  assert.equal(verifyPassword('Current@123', user.passwordHash), true);
  assert.equal(sessionsWereRevoked(), false);
});

test('admin can delete another non-admin user', async () => {
  const target = { id: 'user-2', status: 'ACTIVE' };
  let deletedId = '';
  const dataSource = {
    getRepository(entity: { name: string }) {
      if (entity.name === 'AppUserEntity') {
        return {
          findOneBy: async ({ id }: { id: string }) => id === target.id ? target : null,
          delete: async ({ id }: { id: string }) => {
            deletedId = id;
            return { affected: 1 };
          },
        };
      }
      if (entity.name === 'WorkspaceMemberEntity') {
        return { findOne: async () => ({ userId: target.id, role: 'VIEWER' }) };
      }
      throw new Error(`Unexpected repository: ${entity.name}`);
    },
  };
  const service = new AuthService(dataSource as any);

  assert.deepEqual(await service.deleteUser(target.id, 'admin-1'), { ok: true });
  assert.equal(deletedId, target.id);
});

test('admin cannot delete their own account', async () => {
  const service = new AuthService({} as any);
  await assert.rejects(
    () => service.deleteUser('admin-1', 'admin-1'),
    BadRequestException,
  );
});
