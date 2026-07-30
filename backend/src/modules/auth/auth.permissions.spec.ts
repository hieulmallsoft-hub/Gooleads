import assert from 'node:assert/strict';
import test from 'node:test';
import { getRolePermissions, hasPermission, normalizeRole } from './auth.permissions';

test('unknown roles fail closed to viewer', () => {
  assert.equal(normalizeRole('unknown'), 'VIEWER');
  assert.deepEqual(getRolePermissions('unknown'), ['ads.view']);
});

test('viewer cannot mutate and editor cannot manage users, accounts, or rules', () => {
  assert.equal(hasPermission('VIEWER', 'change.apply'), false);
  assert.equal(hasPermission('EDITOR', 'users.manage'), false);
  assert.equal(hasPermission('EDITOR', 'accounts.manage'), false);
  assert.equal(hasPermission('EDITOR', 'rules.manage'), false);
});

test('editor can manage automation without receiving rule management', () => {
  assert.equal(hasPermission('EDITOR', 'automation.manage'), true);
  assert.equal(hasPermission('ADMIN', 'automation.manage'), true);
  assert.equal(hasPermission('VIEWER', 'automation.manage'), false);
});

test('admin has user and account management permissions', () => {
  assert.equal(hasPermission('ADMIN', 'users.manage'), true);
  assert.equal(hasPermission('ADMIN', 'accounts.manage'), true);
});
