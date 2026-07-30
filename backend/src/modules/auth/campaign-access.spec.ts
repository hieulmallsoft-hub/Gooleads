import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { CampaignAccessService } from './campaign-access.service';

const admin = { role: 'ADMIN', accountAccess: [] } as any;
const editor = {
  role: 'EDITOR',
  accountAccess: [{ customerId: '1234567890' }],
} as any;
const viewer = {
  role: 'VIEWER',
  accountAccess: [{ customerId: '1234567890' }],
} as any;

test('account access is unrestricted for admin and scoped for other roles', () => {
  const service = new CampaignAccessService({} as any);
  assert.equal(service.canViewCustomer(admin, '9999999999'), true);
  assert.equal(service.canViewCustomer(editor, '1234567890'), true);
  assert.equal(service.canViewCustomer(editor, '9999999999'), false);
  assert.throws(() => service.assertCanViewCustomer(editor, '9999999999'), ForbiddenException);
});

test('only editor/admin can edit an accessible ad group', async () => {
  const service = new CampaignAccessService({} as any);
  await service.assertCanEditAdGroup(admin, '9999999999', '1');
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
