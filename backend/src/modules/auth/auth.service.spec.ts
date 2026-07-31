import assert from 'node:assert/strict';
import test from 'node:test';
import { UnauthorizedException } from '@nestjs/common';
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
