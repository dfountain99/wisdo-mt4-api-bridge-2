import {
  DISCORD_ROLE_MAP,
  FUTURE_DISCORD_ROLE_MAP,
  mapDiscordRolesToWisdoAccess,
  normalizeDiscordRoleName,
  canAccessAdmin,
  canRequestCopy,
  canUseCopier,
  hasAnyRole,
  hasPermission,
} from '../config/discordRoleMap.js';

function nowIso() {
  return new Date().toISOString();
}

function roleCacheToNames(cache) {
  if (!cache) return [];
  if (typeof cache.map === 'function') {
    return cache.map((role) => normalizeDiscordRoleName(role?.name || role)).filter(Boolean);
  }
  if (cache instanceof Map) {
    return [...cache.values()].map((role) => normalizeDiscordRoleName(role?.name || role)).filter(Boolean);
  }
  if (Array.isArray(cache)) {
    return cache.map((role) => normalizeDiscordRoleName(role?.name || role)).filter(Boolean);
  }
  if (typeof cache.values === 'function') {
    return [...cache.values()].map((role) => normalizeDiscordRoleName(role?.name || role)).filter(Boolean);
  }
  return [];
}

function arraysChanged(a = [], b = []) {
  const left = [...a].sort();
  const right = [...b].sort();
  return left.length !== right.length || left.some((value, index) => value !== right[index]);
}

export class DiscordRoleSyncService {
  constructor({ config = {}, client = null, repository, logger = console } = {}) {
    this.config = config;
    this.client = client;
    this.repository = repository;
    this.logger = logger;
  }

  guildId() {
    return this.config.guildId || this.config.discord?.guildId || process.env.GUILD_ID || '';
  }

  roleMap() {
    return {
      active: DISCORD_ROLE_MAP,
      future: FUTURE_DISCORD_ROLE_MAP,
    };
  }

  mapDiscordRolesToWisdoRoles(discordRoles = [], manualRoles = [], manualPermissions = []) {
    return mapDiscordRolesToWisdoAccess(discordRoles, manualRoles, manualPermissions);
  }

  async getDiscordRoles(discordUserId = '') {
    const userId = String(discordUserId || '').trim();
    if (!userId) return { ok: false, source: 'missing_discord_user_id', discordRoles: [], error: 'Discord user id is required.' };
    if (!this.client || !this.guildId()) {
      return { ok: false, source: 'discord_client_unavailable', discordRoles: [], error: 'Discord client or guild id is not available in this runtime.' };
    }

    try {
      const guild = this.client.guilds?.cache?.get?.(this.guildId()) || await this.client.guilds?.fetch?.(this.guildId());
      if (!guild) return { ok: false, source: 'guild_not_found', discordRoles: [], error: 'Discord guild was not found.' };
      const member = guild.members?.cache?.get?.(userId) || await guild.members?.fetch?.(userId);
      if (!member) return { ok: false, source: 'member_not_found', discordRoles: [], error: 'Discord member was not found.' };
      const discordRoles = roleCacheToNames(member.roles?.cache || member.roles);
      return { ok: true, source: 'discord_api', discordRoles };
    } catch (error) {
      this.logger?.warn?.('Discord role sync lookup failed', { discordUserId: userId, error: error.message });
      return { ok: false, source: 'discord_api_error', discordRoles: [], error: error.message };
    }
  }

  async getRoleSyncStatus(userId = '') {
    const key = String(userId || '').trim();
    const state = await this.repository.loadState();
    return state.roleSyncByUserId?.[key] || this.fallbackStatus(key, state);
  }

  async listRoleSyncStatuses() {
    const state = await this.repository.loadState();
    return Object.values(state.roleSyncByUserId || {}).sort((a, b) => String(b.lastSyncedAt || '').localeCompare(String(a.lastSyncedAt || '')));
  }

  async getAccessForUser(userId = '') {
    const status = await this.getRoleSyncStatus(userId);
    return this.publicAccess(status);
  }

  async syncUserRolesFromDiscord(userId = '', discordUserId = '', options = {}) {
    const key = String(userId || discordUserId || '').trim();
    const discordId = String(discordUserId || key || '').trim();
    if (!key) throw new Error('userId is required for role sync.');

    let saved;
    await this.repository.updateState(async (state) => {
      state.roleSyncByUserId ||= {};
      state.roleOverridesByUserId ||= {};
      state.usersById ||= {};

      const previous = state.roleSyncByUserId[key] || {};
      const overrides = state.roleOverridesByUserId[key] || {};
      const lookup = await this.getDiscordRoles(discordId || previous.discordUserId);
      const discordRoles = lookup.ok ? lookup.discordRoles : (previous.discordRoles || []);
      const mapped = this.mapDiscordRolesToWisdoRoles(discordRoles, overrides.wisdoRoles || [], overrides.permissions || []);
      const changed = arraysChanged(previous.discordRoles || [], discordRoles)
        || arraysChanged(previous.wisdoRoles || [], mapped.wisdoRoles)
        || arraysChanged(previous.permissions || [], mapped.permissions);

      saved = {
        userId: key,
        discordUserId: discordId || previous.discordUserId || key,
        discordRoles,
        matchedDiscordRoles: mapped.matchedDiscordRoles,
        wisdoRoles: mapped.wisdoRoles,
        internalRoles: mapped.internalRoles,
        permissions: mapped.permissions,
        accessLevel: mapped.accessLevel,
        gates: mapped.gates,
        manualOverrides: overrides,
        stale: !lookup.ok,
        source: lookup.source,
        errors: lookup.ok ? [] : [lookup.error].filter(Boolean),
        lastSyncedAt: nowIso(),
        version: mapped.version,
      };

      state.roleSyncByUserId[key] = saved;
      state.usersById[key] = {
        ...(state.usersById[key] || {}),
        userId: key,
        discordUserId: saved.discordUserId,
        wisdoRoles: saved.wisdoRoles,
        permissions: saved.permissions,
        accessLevel: saved.accessLevel,
        updatedAt: nowIso(),
        createdAt: state.usersById[key]?.createdAt || nowIso(),
      };

      this.addAuditToState(state, {
        actorUserId: options.actorUserId || key,
        action: options.manual ? 'manual_role_refresh' : 'discord_roles.synced',
        targetType: 'UserRoleSync',
        targetId: key,
        metadata: {
          discordUserId: saved.discordUserId,
          source: saved.source,
          stale: saved.stale,
          matchedDiscordRoles: saved.matchedDiscordRoles,
          wisdoRoles: saved.wisdoRoles,
        },
      });

      if (changed) {
        this.addAuditToState(state, {
          actorUserId: options.actorUserId || 'system',
          action: 'wisdo_roles.changed_from_discord_sync',
          targetType: 'User',
          targetId: key,
          metadata: {
            previousRoles: previous.wisdoRoles || [],
            nextRoles: saved.wisdoRoles,
            previousDiscordRoles: previous.discordRoles || [],
            nextDiscordRoles: saved.discordRoles,
          },
        });
      }

      const previousAccess = this.publicAccess(previous);
      const nextAccess = this.publicAccess(saved);
      if ((!previousAccess.gates.admin && nextAccess.gates.admin) || (!previousAccess.gates.copier && nextAccess.gates.copier)) {
        this.addAuditToState(state, {
          actorUserId: options.actorUserId || 'system',
          action: 'wisdo_access.granted_after_role_sync',
          targetType: 'User',
          targetId: key,
          metadata: {
            adminGranted: !previousAccess.gates.admin && nextAccess.gates.admin,
            copierGranted: !previousAccess.gates.copier && nextAccess.gates.copier,
            wisdoRoles: saved.wisdoRoles,
            matchedDiscordRoles: saved.matchedDiscordRoles,
          },
        });
      }

      return state;
    });

    return saved;
  }

  async refreshDiscordRoleCache(userId = '', options = {}) {
    const status = await this.getRoleSyncStatus(userId);
    return this.syncUserRolesFromDiscord(userId, status.discordUserId || userId, options);
  }

  async requireDiscordRole(userId = '', roleName = '') {
    const status = await this.getRoleSyncStatus(userId);
    return (status.discordRoles || []).includes(normalizeDiscordRoleName(roleName));
  }

  async hasSyncedRole(userId = '', wisdoRole = '') {
    const status = await this.getRoleSyncStatus(userId);
    return hasAnyRole(status, [wisdoRole]);
  }

  async requirePermission(userId = '', permission = '') {
    const status = await this.getRoleSyncStatus(userId);
    return hasPermission(status, permission);
  }

  canAccessAdmin(access = {}) {
    return canAccessAdmin(access);
  }

  canUseCopier(access = {}) {
    return canUseCopier(access);
  }

  canRequestCopy(access = {}) {
    return canRequestCopy(access);
  }

  publicAccess(status = {}) {
    return {
      userId: status.userId,
      discordUserId: status.discordUserId,
      discordRoles: status.discordRoles || [],
      matchedDiscordRoles: status.matchedDiscordRoles || [],
      wisdoRoles: status.wisdoRoles || status.internalRoles || [],
      internalRoles: status.internalRoles || status.wisdoRoles || [],
      permissions: status.permissions || [],
      accessLevel: status.accessLevel || 'none',
      gates: {
        admin: canAccessAdmin(status),
        copier: canUseCopier(status),
        copyRequest: canRequestCopy(status),
      },
      stale: Boolean(status.stale),
      source: status.source || 'fallback',
      lastSyncedAt: status.lastSyncedAt || null,
      version: status.version || null,
    };
  }

  fallbackStatus(userId = '', state = {}) {
    const key = String(userId || '').trim();
    const configuredOwner = String(this.config.ownerUserId || process.env.OWNER_USER_ID || '').trim();
    const user = state.usersById?.[key] || {};
    const discordRoles = configuredOwner && key === configuredOwner ? ['OWNER'] : (user.discordRoles || []);
    const mapped = this.mapDiscordRolesToWisdoRoles(discordRoles, user.wisdoRoles || [], user.permissions || []);
    return {
      userId: key,
      discordUserId: user.discordUserId || key,
      discordRoles,
      matchedDiscordRoles: mapped.matchedDiscordRoles,
      wisdoRoles: mapped.wisdoRoles,
      internalRoles: mapped.internalRoles,
      permissions: mapped.permissions,
      accessLevel: mapped.accessLevel,
      gates: mapped.gates,
      stale: true,
      source: discordRoles.length ? 'local_user_record' : 'default_guest',
      errors: [],
      lastSyncedAt: null,
      version: mapped.version,
    };
  }

  addAuditToState(state, { actorUserId = 'system', action, targetType = '', targetId = '', metadata = {} } = {}) {
    if (typeof this.repository.addAuditToState === 'function') {
      return this.repository.addAuditToState(state, { adminId: actorUserId, action, targetType, targetId, data: metadata });
    }
    state.adminAuditLogsById ||= {};
    const auditLogId = `audit_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    state.adminAuditLogsById[auditLogId] = {
      auditLogId,
      actorUserId: String(actorUserId || 'system'),
      action,
      targetType,
      targetId: String(targetId || ''),
      metadata,
      createdAt: nowIso(),
    };
    return state.adminAuditLogsById[auditLogId];
  }
}
