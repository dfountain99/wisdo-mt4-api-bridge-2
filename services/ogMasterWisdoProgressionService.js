import {
  applyOgMasterMissionAttempt,
  createOgMasterProgress,
  normalizeOgMasterProgress,
  publicOgMasterState,
} from './ogMasterWisdoService.js';

function clean(value, max = 200) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

function bestArcadeMastery(profile = {}) {
  const rows = Array.isArray(profile?.mastery) ? profile.mastery : [];
  return rows.reduce((best, row) => Math.max(best, Number(row?.bestMastery || 0)), 0);
}

export class OgMasterWisdoProgressionService {
  constructor({ pool, arcadeProgression = null, logger = console } = {}) {
    if (!pool?.query || !pool?.connect) throw new TypeError('OgMasterWisdoProgressionService requires a PostgreSQL pool.');
    this.pool = pool;
    this.arcadeProgression = arcadeProgression;
    this.logger = logger;
    this.schemaPromise = null;
  }

  async ensureSchema() {
    if (this.schemaPromise) return this.schemaPromise;
    this.schemaPromise = this.pool.query(`
      CREATE TABLE IF NOT EXISTS wisdo_og_master_progress (
        user_id TEXT PRIMARY KEY,
        progress JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_wisdo_og_master_updated ON wisdo_og_master_progress(updated_at DESC);
    `).catch((error) => {
      this.schemaPromise = null;
      throw error;
    });
    return this.schemaPromise;
  }

  async arcadeState(userId) {
    if (!this.arcadeProgression?.profile) return { level: null, bestMastery: null, connected: false };
    try {
      const profile = await this.arcadeProgression.profile(userId, { compact: true });
      return {
        level: Number.isFinite(Number(profile?.level)) ? Number(profile.level) : null,
        bestMastery: bestArcadeMastery(profile),
        connected: true,
      };
    } catch (error) {
      this.logger?.warn?.('OG MASTER Arcade progression lookup degraded.', { message: error?.message });
      return { level: null, bestMastery: null, connected: false };
    }
  }

  async ensureRow(userId, client = this.pool) {
    const uid = clean(userId);
    await client.query(`INSERT INTO wisdo_og_master_progress(user_id, progress) VALUES($1, $2::jsonb) ON CONFLICT(user_id) DO NOTHING`, [uid, JSON.stringify(createOgMasterProgress())]);
    return uid;
  }

  async profile(userId) {
    await this.ensureSchema();
    const uid = await this.ensureRow(userId);
    const [rowResult, arcade] = await Promise.all([
      this.pool.query(`SELECT progress, created_at, updated_at FROM wisdo_og_master_progress WHERE user_id=$1`, [uid]),
      this.arcadeState(uid),
    ]);
    const row = rowResult.rows[0] || {};
    const state = publicOgMasterState(normalizeOgMasterProgress(row.progress || {}), {
      arcadeLevel: arcade.level,
      arcadeBestMastery: arcade.bestMastery,
    });
    return Object.freeze({
      ...state,
      arcade: Object.freeze({ level: arcade.level, bestMastery: arcade.bestMastery, connected: arcade.connected }),
      rewardHandoff: Object.freeze({
        trophyRoom: Object.freeze({ earnedTrophyIds: state.progress.trophies, route: '/member/home' }),
        coach: Object.freeze({ advancedModules: state.progress.advancedCoachModules, route: '/member/wisdo' }),
        identity: Object.freeze({ earnedTitles: state.progress.titles, earnedBadges: state.progress.badges }),
      }),
      persistence: 'postgresql',
    });
  }

  async submitMission(userId, missionId, answers) {
    await this.ensureSchema();
    const uid = clean(userId);
    const arcade = await this.arcadeState(uid);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await this.ensureRow(uid, client);
      const selected = await client.query(`SELECT progress FROM wisdo_og_master_progress WHERE user_id=$1 FOR UPDATE`, [uid]);
      const progress = normalizeOgMasterProgress(selected.rows[0]?.progress || {});
      const result = applyOgMasterMissionAttempt(progress, {
        missionId,
        answers,
        arcadeLevel: arcade.level,
        arcadeBestMastery: arcade.bestMastery,
      });
      await client.query(`UPDATE wisdo_og_master_progress SET progress=$2::jsonb, updated_at=NOW() WHERE user_id=$1`, [uid, JSON.stringify(result.progress)]);
      await client.query('COMMIT');
      const state = Object.freeze({
        ...result.state,
        arcade: Object.freeze({ level: arcade.level, bestMastery: arcade.bestMastery, connected: arcade.connected }),
        rewardHandoff: Object.freeze({
          trophyRoom: Object.freeze({ earnedTrophyIds: result.state.progress.trophies, route: '/member/home' }),
          coach: Object.freeze({ advancedModules: result.state.progress.advancedCoachModules, route: '/member/wisdo' }),
          identity: Object.freeze({ earnedTitles: result.state.progress.titles, earnedBadges: result.state.progress.badges }),
        }),
        persistence: 'postgresql',
      });
      return Object.freeze({ grade: result.grade, firstCompletion: result.firstCompletion, awards: result.awards, state });
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch {}
      throw error;
    } finally {
      client.release();
    }
  }

  async health() {
    await this.ensureSchema();
    const result = await this.pool.query(`SELECT COUNT(*)::int AS profiles FROM wisdo_og_master_progress`);
    return Object.freeze({ ok: true, service: 'og-master-wisdo-progression', profiles: Number(result.rows[0]?.profiles || 0), liveMt4Execution: false });
  }
}
