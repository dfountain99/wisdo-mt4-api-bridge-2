export const ROLE_SYNC_VERSION = 'wisdo-rbac-phase-1';

export const ADMIN_ROLES = ['owner', 'super_admin', 'admin', 'wisdo_core'];
export const COPIER_ROLES = ['premium_member', 'paid_member', 'copier_eligible', 'owner', 'super_admin', 'admin'];

export const DISCORD_ROLE_MAP = {
  OWNER: {
    discordRoleName: 'OWNER',
    internalRoles: ['owner', 'super_admin'],
    permissions: [
      'platform.full_access',
      'users.manage',
      'bots.manage',
      'marketplace.manage',
      'copy.manage',
      'affiliate.manage',
      'payouts.approve',
      'payouts.mark_paid',
      'rbac.manage',
      'audit.view',
      'support.manage',
      'emergency.pause',
      'mt4.dangerous.confirmed',
    ],
    accessLevel: 'owner',
    description: 'Full platform ownership and emergency control.',
  },
  WISDO: {
    discordRoleName: 'WISDO',
    internalRoles: ['admin', 'wisdo_core'],
    permissions: [
      'admin.dashboard',
      'wisdo.modules.manage',
      'bots.manage',
      'education.manage',
      'marketplace.manage',
      'announcements.manage',
      'logs.view',
      'feature_flags.manage',
      'command_center.access',
    ],
    accessLevel: 'admin',
    description: 'Wisdo operating staff and module administrators.',
  },
  Culture: {
    discordRoleName: 'Culture',
    internalRoles: ['culture_member', 'trader', 'member'],
    permissions: [
      'portal.member',
      'accounts.connect',
      'dashboard.use',
      'education.standard',
      'simulator.standard',
      'marketplace.preview',
      'copy.request',
      'social.post',
      'risk.manage_own',
    ],
    accessLevel: 'member',
    description: 'Core community member and trading desk access.',
  },
  'CULTURE COIN MEMBER+': {
    discordRoleName: 'CULTURE COIN MEMBER+',
    internalRoles: ['premium_member', 'paid_member', 'copier_eligible'],
    permissions: [
      'portal.member',
      'accounts.connect',
      'dashboard.use',
      'copy.request',
      'copy.use',
      'bots.premium.access',
      'bots.purchase',
      'bots.rent',
      'education.premium',
      'marketplace.member_sections',
      'simulator.advanced',
      'signals.premium',
      'risk.manage_own',
    ],
    accessLevel: 'premium',
    description: 'Paid member unlocks premium marketplace, copier, and education lanes.',
  },
  Members: {
    discordRoleName: 'Members',
    internalRoles: ['member', 'basic_user'],
    permissions: ['portal.member', 'accounts.connect', 'dashboard.use', 'marketplace.preview', 'education.standard'],
    accessLevel: 'basic',
    description: 'Basic community access.',
  },
  TikTok: {
    discordRoleName: 'TikTok',
    internalRoles: ['social_audience', 'lead'],
    permissions: ['portal.preview', 'marketplace.preview', 'onboarding.view'],
    accessLevel: 'lead',
    description: 'Social audience and funnel lead.',
  },
  'PIP DRILL 🚨': {
    discordRoleName: 'PIP DRILL 🚨',
    internalRoles: ['signal_student', 'drill_member'],
    permissions: ['portal.member', 'education.standard', 'education.pip_drill', 'signals.drill', 'simulator.standard'],
    accessLevel: 'track',
    description: 'Signal drill and pip practice track.',
  },
  FLOW: {
    discordRoleName: 'FLOW',
    internalRoles: ['flow_member', 'strategy_track_member'],
    permissions: ['portal.member', 'education.standard', 'education.flow', 'strategy.flow', 'simulator.standard'],
    accessLevel: 'track',
    description: 'Flow strategy education track.',
  },
};

export const FUTURE_DISCORD_ROLE_MAP = {
  Affiliate: {
    internalRoles: ['affiliate'],
    permissions: ['affiliate.dashboard', 'affiliate.links.create', 'affiliate.payouts.request'],
    planned: true,
  },
  Creator: {
    internalRoles: ['creator', 'strategy_provider'],
    permissions: ['bots.submit', 'education.create', 'marketplace.creator_profile'],
    planned: true,
  },
  'Strategy Provider': {
    internalRoles: ['strategy_provider'],
    permissions: ['copy.provide', 'signals.provide', 'profile.public_trader'],
    planned: true,
  },
  VIP: {
    internalRoles: ['vip_member'],
    permissions: ['support.priority', 'education.vip', 'marketplace.vip'],
    planned: true,
  },
  'Beta Tester': {
    internalRoles: ['beta_tester'],
    permissions: ['features.beta', 'feedback.submit'],
    planned: true,
  },
};

const ACCESS_RANK = {
  none: 0,
  lead: 1,
  basic: 2,
  member: 3,
  track: 4,
  premium: 5,
  admin: 6,
  owner: 7,
};

export function normalizeDiscordRoleName(role = '') {
  return String(role?.name || role || '').trim().replace(/\s+/g, ' ');
}

function pushUnique(target, values = []) {
  for (const value of values) {
    const clean = String(value || '').trim();
    if (clean && !target.includes(clean)) target.push(clean);
  }
}

export function mapDiscordRolesToWisdoAccess(discordRoles = [], manualRoles = [], manualPermissions = []) {
  const roleNames = (Array.isArray(discordRoles) ? discordRoles : []).map(normalizeDiscordRoleName).filter(Boolean);
  const matchedDiscordRoles = [];
  const internalRoles = [];
  const permissions = [];
  let accessLevel = 'none';

  for (const roleName of roleNames) {
    const mapping = DISCORD_ROLE_MAP[roleName];
    if (!mapping) continue;
    matchedDiscordRoles.push(roleName);
    pushUnique(internalRoles, mapping.internalRoles);
    pushUnique(permissions, mapping.permissions);
    if ((ACCESS_RANK[mapping.accessLevel] || 0) > (ACCESS_RANK[accessLevel] || 0)) {
      accessLevel = mapping.accessLevel;
    }
  }

  pushUnique(internalRoles, manualRoles);
  pushUnique(permissions, manualPermissions);

  if (!internalRoles.length) {
    pushUnique(internalRoles, ['guest']);
    pushUnique(permissions, ['portal.preview']);
    accessLevel = 'none';
  } else if (internalRoles.some((role) => ADMIN_ROLES.includes(role)) && ACCESS_RANK[accessLevel] < ACCESS_RANK.admin) {
    accessLevel = 'admin';
  } else if (internalRoles.some((role) => COPIER_ROLES.includes(role)) && ACCESS_RANK[accessLevel] < ACCESS_RANK.premium) {
    accessLevel = 'premium';
  }

  return {
    version: ROLE_SYNC_VERSION,
    discordRoles: roleNames,
    matchedDiscordRoles,
    wisdoRoles: internalRoles,
    permissions,
    internalRoles,
    accessLevel,
    gates: {
      admin: canAccessAdmin({ wisdoRoles: internalRoles, permissions }),
      copier: canUseCopier({ wisdoRoles: internalRoles, permissions }),
    },
  };
}

export function hasAnyRole(access = {}, roles = []) {
  const owned = access.wisdoRoles || access.internalRoles || [];
  return roles.some((role) => owned.includes(role));
}

export function hasPermission(access = {}, permission = '') {
  const permissions = access.permissions || [];
  return permissions.includes('platform.full_access') || permissions.includes(permission);
}

export function canAccessAdmin(access = {}) {
  return hasAnyRole(access, ADMIN_ROLES) || hasPermission(access, 'admin.dashboard') || hasPermission(access, 'rbac.manage');
}

export function canUseCopier(access = {}) {
  return hasAnyRole(access, COPIER_ROLES) || hasPermission(access, 'copy.use') || hasPermission(access, 'copy.manage');
}

export function canRequestCopy(access = {}) {
  return canUseCopier(access) || hasPermission(access, 'copy.request');
}

export function canSeeMarketplaceBot(access = {}, bot = {}) {
  if (canAccessAdmin(access)) return true;
  const level = String(bot.accessLevel || bot.accessType || '').toLowerCase();
  if (!level || ['free', 'public', 'preview', 'trial'].includes(level)) return true;
  if (['member', 'members', 'basic'].includes(level)) {
    return hasPermission(access, 'portal.member');
  }
  if (['culture', 'trader'].includes(level)) {
    return hasAnyRole(access, ['culture_member', 'trader', 'premium_member', 'paid_member']) || hasPermission(access, 'copy.request');
  }
  if (['paid', 'premium'].includes(level)) {
    return hasPermission(access, 'marketplace.member_sections') || hasPermission(access, 'bots.premium.access') || hasPermission(access, 'bots.purchase');
  }
  if (['pip_drill', 'pip-drill', 'signal_drill'].includes(level)) return hasPermission(access, 'education.pip_drill') || hasPermission(access, 'signals.drill');
  if (['flow', 'flow_track'].includes(level)) return hasPermission(access, 'education.flow') || hasPermission(access, 'strategy.flow');
  if (['admin', 'private', 'owner'].includes(level)) return false;
  if (bot.requiredDiscordRole) return (access.discordRoles || []).includes(normalizeDiscordRoleName(bot.requiredDiscordRole));
  if (bot.requiredRole) return hasAnyRole(access, [bot.requiredRole]);
  return false;
}

export function canAccessEducationModule(access = {}, module = {}) {
  if (canAccessAdmin(access)) return true;
  const requiredDiscordRole = module.requiredDiscordRole || module.discordRole;
  if (requiredDiscordRole && !(access.discordRoles || []).includes(normalizeDiscordRoleName(requiredDiscordRole))) return false;
  const allowedRoles = module.allowedRoles || module.requiredWisdoRoles || [];
  if (allowedRoles.length && !hasAnyRole(access, allowedRoles)) return false;
  const level = String(module.accessLevel || module.tier || '').toLowerCase();
  if (!level || ['free', 'public', 'standard', 'basic'].includes(level)) return hasPermission(access, 'education.standard') || hasPermission(access, 'portal.member');
  if (['culture', 'trader'].includes(level)) return hasAnyRole(access, ['culture_member', 'trader', 'premium_member', 'paid_member']) || hasPermission(access, 'copy.request');
  if (level === 'premium') return hasPermission(access, 'education.premium');
  if (level === 'pip_drill') return hasPermission(access, 'education.pip_drill');
  if (level === 'flow') return hasPermission(access, 'education.flow');
  if (['admin', 'private', 'owner'].includes(level)) return false;
  return false;
}
