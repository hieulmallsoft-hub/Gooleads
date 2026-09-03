import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { CampaignAccessService } from './campaign-access.service';

const admin = {
  role: 'ADMIN',
  accountAccess: [{ customerId: '9920642691' }],
} as any;
const editor = {
  role: 'EDITOR',
  accountAccess: [{ customerId: '1234567890' }],
} as any;
const viewer = {
  role: 'VIEWER',
  accountAccess: [{ customerId: '1234567890' }],
} as any;

test('account access is scoped for admin and other roles', () => {
  const service = new CampaignAccessService({} as any);
  assert.equal(service.canViewCustomer(admin, '9920642691'), true);
  assert.equal(service.canViewCustomer(admin, '9999999999'), false);
  assert.equal(service.canViewCustomer(editor, '1234567890'), true);
  assert.equal(service.canViewCustomer(editor, '9999999999'), false);
  assert.throws(() => service.assertCanViewCustomer(editor, '9999999999'), ForbiddenException);
});

test('only an assigned editor/admin can edit an accessible ad group', async () => {
  const service = new CampaignAccessService({} as any);
  await service.assertCanEditAdGroup(admin, '9920642691', '1');
  await assert.rejects(
    () => service.assertCanEditAdGroup(admin, '9999999999', '1'),
    ForbiddenException,
  );
  await service.assertCanEditAdGroup(editor, '1234567890', '1');
  await assert.rejects(
    () => service.assertCanEditAdGroup(viewer, '1234567890', '1'),
    ForbiddenException,
  );
  await assert.rejects(
    () => service.assertCanEditAdGroup(editor, '9999999999', '1'),
    ForbiddenException,
  );
});
