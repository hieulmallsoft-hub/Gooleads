export type AppRole = 'ADMIN' | 'EDITOR' | 'VIEWER';

export type Permission =
  | 'ads.view'
  | 'ai.generate'
  | 'suggestion.approve'
  | 'change.preview'
  | 'change.apply'
  | 'media.replace'
  | 'campaign_groups.manage'
  | 'rules.manage'
  | 'automation.manage'
  | 'users.manage'
  | 'accounts.manage';

export const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  ADMIN: [
    'ads.view',
    'ai.generate',
    'suggestion.approve',
    'change.preview',
    'change.apply',
    'media.replace',
    'campaign_groups.manage',
    'rules.manage',
    'automation.manage',
    'users.manage',
    'accounts.manage',
  ],
  EDITOR: [
    'ads.view',
    'ai.generate',
    'suggestion.approve',
    'change.preview',
    'change.apply',
    'media.replace',
    'campaign_groups.manage',
    'automation.manage',
  ],
  VIEWER: ['ads.view'],
};

export function normalizeRole(value: string | null | undefined): AppRole {
  const role = String(value ?? '').trim().toUpperCase();
  if (role === 'ADMIN' || role === 'EDITOR' || role === 'VIEWER') {
    return role;
  }
  return 'VIEWER';
}

export function getRolePermissions(role: string | null | undefined) {
  return ROLE_PERMISSIONS[normalizeRole(role)];
}

export function hasPermission(role: string | null | undefined, permission: Permission) {
  return getRolePermissions(role).includes(permission);
}
