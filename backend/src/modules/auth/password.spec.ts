import assert from 'node:assert/strict';
import test from 'node:test';
import { getPasswordPolicyError, hashPassword, verifyPassword } from './password';

test('password policy accepts a strong password', () => {
  assert.equal(getPasswordPolicyError('Strong@1234'), null);
});

test('password policy rejects weak passwords', () => {
  assert.ok(getPasswordPolicyError('short'));
  assert.ok(getPasswordPolicyError('lowercaseonly1!'));
  assert.ok(getPasswordPolicyError('NoNumberHere!'));
  assert.ok(getPasswordPolicyError('NoSpecial123'));
});

test('password hashes verify only the original password', () => {
  const hash = hashPassword('Strong@1234');
  assert.equal(verifyPassword('Strong@1234', hash), true);
  assert.equal(verifyPassword('Wrong@1234', hash), false);
});
