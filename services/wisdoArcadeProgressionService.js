import crypto from 'node:crypto';
import {
  ACHIEVEMENTS,
  ARCADE_ALPHA3_BUILD,
  ARCADE_ALPHA3_VERSION,
  FLOOR_LEVELS,
  achievementCandidates,
  computeRunXp,
  dailyChallenges,
  enrichCatalogForLevel,
  floorUnlockState,
  levelFromXp,
  levelProgress,
  masteryTier,
  seasonId,
  utcDateKey,
} from '../public/app/world/arcade/alpha3-progression-core.js';

function clean(value,max=200){return String(value??'').replace(/\u0000/g,'').trim().slice(0,max);}
function integer(value,min,max,fallback=0){const n=Math.trunc(Number(value));return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
function anonymousPlayer(userId){return `OP-${crypto.createHash('sha256').update(String(userId)).digest('hex').slice(0,8).toUpperCase()}`;}
function yesterdayKey(date=new Date()){const copy=new Date(date);copy.setUTCDate(copy.getUTCDate()-1);return utcDateKey(copy);}

export class WisdoArcadeProgressionService{
  constructor({pool,logger=console}={}){
    if(!pool?.query)throw new TypeError('WisdoArcadeProgressionService requires a PostgreSQL pool.');
    this.pool=pool;this.logger=logger;this.schemaPromise=null;
  }

  async ensureSchema(){
    if(this.schemaPromise)return this.schemaPromise;
    this.schemaPromise=this.pool.query(`
      CREATE TABLE IF NOT EXISTS wisdo_arcade_progression (
        user_id TEXT PRIMARY KEY,
        total_xp INTEGER NOT NULL DEFAULT 0,
        level INTEGER NOT NULL DEFAULT 1,
        current_streak INTEGER NOT NULL DEFAULT 0,
        longest_streak INTEGER NOT NULL DEFAULT 0,
        last_play_date DATE,
        season_id TEXT NOT NULL,
        season_xp INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_wisdo_arcade_progression_season ON wisdo_arcade_progression(season_id, season_xp DESC, total_xp DESC);

      CREATE TABLE IF NOT EXISTS wisdo_arcade_progression_events (
        session_id UUID PRIMARY KEY,
        user_id TEXT NOT NULL,
        game_id TEXT NOT NULL,
        xp_awarded INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_wisdo_arcade_progression_events_user ON wisdo_arcade_progression_events(user_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS wisdo_arcade_game_mastery (
        user_id TEXT NOT NULL,
        game_id TEXT NOT NULL,
        xp INTEGER NOT NULL DEFAULT 0,
        sessions INTEGER NOT NULL DEFAULT 0,
        wins INTEGER NOT NULL DEFAULT 0,
        best_score INTEGER NOT NULL DEFAULT 0,
        best_mastery INTEGER NOT NULL DEFAULT 0,
        mastery_tier TEXT NOT NULL DEFAULT 'ROOKIE',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY(user_id, game_id)
      );
      CREATE INDEX IF NOT EXISTS idx_wisdo_arcade_mastery_user ON wisdo_arcade_game_mastery(user_id, best_mastery DESC, xp DESC);

      CREATE TABLE IF NOT EXISTS wisdo_arcade_achievements (
        user_id TEXT NOT NULL,
        achievement_id TEXT NOT NULL,
        reward_xp INTEGER NOT NULL DEFAULT 0,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY(user_id, achievement_id)
      );
      CREATE INDEX IF NOT EXISTS idx_wisdo_arcade_achievements_user ON wisdo_arcade_achievements(user_id, unlocked_at DESC);

      CREATE TABLE IF NOT EXISTS wisdo_arcade_daily_challenges (
        user_id TEXT NOT NULL,
        challenge_date DATE NOT NULL,
        challenge_id TEXT NOT NULL,
        metric TEXT NOT NULL,
        progress INTEGER NOT NULL DEFAULT 0,
        target INTEGER NOT NULL,
        reward_xp INTEGER NOT NULL DEFAULT 0,
        completed BOOLEAN NOT NULL DEFAULT FALSE,
        completed_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY(user_id, challenge_date, challenge_id)
      );
      CREATE INDEX IF NOT EXISTS idx_wisdo_arcade_daily_user ON wisdo_arcade_daily_challenges(user_id, challenge_date DESC);
    `).catch((error)=>{this.schemaPromise=null;throw error;});
    return this.schemaPromise;
  }

  async ensureUserRow(userId,client=this.pool){
    const uid=clean(userId,200);const sid=seasonId();
    await client.query(`INSERT INTO wisdo_arcade_progression(user_id,season_id) VALUES($1,$2) ON CONFLICT(user_id) DO NOTHING`,[uid,sid]);
    await client.query(`UPDATE wisdo_arcade_progression SET season_id=$2,season_xp=CASE WHEN season_id=$2 THEN season_xp ELSE 0 END,updated_at=NOW() WHERE user_id=$1 AND season_id<>$2`,[uid,sid]);
    return uid;
  }

  async ensureDailyChallenges(userId,client=this.pool,date=new Date()){
    const uid=clean(userId,200),dateKey=utcDateKey(date),challenges=dailyChallenges(date);
    for(const challenge of challenges){
      await client.query(`INSERT INTO wisdo_arcade_daily_challenges(user_id,challenge_date,challenge_id,metric,target,reward_xp) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id,challenge_date,challenge_id) DO NOTHING`,[uid,dateKey,challenge.id,challenge.metric,challenge.target,challenge.rewardXp]);
    }
    return challenges;
  }

  async assertGameAccess(userId,game){
    if(!game)return;
    const state=await this.profile(userId,{compact:true});
    const gate=state.floors?.[game.floor];
    if(game.status==='playable'&&gate&&!gate.unlocked){
      const error=new Error(`${game.name} unlocks at Arcade Level ${gate.requiredLevel}. Keep learning in the unlocked cabinets to earn XP.`);
      error.statusCode=403;throw error;
    }
  }

  async catalogForUser(userId,catalog=[]){
    const progression=await this.profile(userId,{compact:true});
    return {progression,games:enrichCatalogForLevel(catalog,progression.level)};
  }

  async recordVerifiedRun(userId,finishPayload={}){
    await this.ensureSchema();
    const uid=clean(userId,200),sessionId=clean(finishPayload.sessionId,100),gameId=clean(finishPayload.gameId,80);
    if(!sessionId||!gameId||finishPayload.status!=='finalized')return this.profile(uid);
    const education=finishPayload.result?.education||{},verified=finishPayload.result?.verified||{};
    const client=await this.pool.connect();
    try{
      await client.query('BEGIN');
      await this.ensureUserRow(uid,client);
      const eventInsert=await client.query(`INSERT INTO wisdo_arcade_progression_events(session_id,user_id,game_id,xp_awarded) VALUES($1,$2,$3,0) ON CONFLICT(session_id) DO NOTHING RETURNING session_id`,[sessionId,uid,gameId]);
      if(!eventInsert.rows.length){await client.query('COMMIT');return this.profile(uid);}

      await this.ensureDailyChallenges(uid,client);
      const progressionResult=await client.query(`SELECT * FROM wisdo_arcade_progression WHERE user_id=$1 FOR UPDATE`,[uid]);
      const row=progressionResult.rows[0];
      const today=utcDateKey(),last=row.last_play_date?utcDateKey(row.last_play_date):null;
      let streak=Number(row.current_streak||0);
      if(last!==today)streak=last===yesterdayKey()?Math.max(1,streak+1):1;
      const longest=Math.max(Number(row.longest_streak||0),streak);
      const currentSeason=seasonId();
      const seasonXpBefore=row.season_id===currentSeason?Number(row.season_xp||0):0;
      const baseXp=computeRunXp({education,verified,cultureCoinAwarded:finishPayload.cultureCoinAwarded});

      const bestScore=Math.max(0,integer(verified.score,0,2_000_000_000,0));
      const bestMastery=Math.max(0,integer(education.weighted,0,100,0));
      const won=verified.status==='won'?1:0;
      const existingMastery=await client.query(`SELECT best_mastery FROM wisdo_arcade_game_mastery WHERE user_id=$1 AND game_id=$2`,[uid,gameId]);
      const masteryBestAfter=Math.max(Number(existingMastery.rows[0]?.best_mastery||0),bestMastery);
      await client.query(`
        INSERT INTO wisdo_arcade_game_mastery(user_id,game_id,xp,sessions,wins,best_score,best_mastery,mastery_tier)
        VALUES($1,$2,$3,1,$4,$5,$6,$7)
        ON CONFLICT(user_id,game_id) DO UPDATE SET
          xp=wisdo_arcade_game_mastery.xp+EXCLUDED.xp,
          sessions=wisdo_arcade_game_mastery.sessions+1,
          wins=wisdo_arcade_game_mastery.wins+EXCLUDED.wins,
          best_score=GREATEST(wisdo_arcade_game_mastery.best_score,EXCLUDED.best_score),
          best_mastery=GREATEST(wisdo_arcade_game_mastery.best_mastery,EXCLUDED.best_mastery),
          mastery_tier=$7,
          updated_at=NOW()
      `,[uid,gameId,baseXp,won,bestScore,bestMastery,masteryTier(masteryBestAfter)]);

      const distinctTodayResult=await client.query(`SELECT ARRAY_AGG(DISTINCT game_id) AS games FROM wisdo_arcade_sessions WHERE user_id=$1 AND status='finalized' AND finalized_at>=date_trunc('day',NOW())`,[uid]);
      const distinctToday=Array.isArray(distinctTodayResult.rows[0]?.games)?distinctTodayResult.rows[0].games:[];
      let challengeBonusXp=0;
      const challengeDefs=dailyChallenges();
      for(const challenge of challengeDefs){
        const challengeRowResult=await client.query(`SELECT * FROM wisdo_arcade_daily_challenges WHERE user_id=$1 AND challenge_date=$2 AND challenge_id=$3 FOR UPDATE`,[uid,today,challenge.id]);
        const challengeRow=challengeRowResult.rows[0];
        let next=Number(challengeRow?.progress||0);
        if(challenge.metric==='sessions')next+=1;
        else if(challenge.metric==='mastery70'&&Number(education.weighted||0)>=70)next+=1;
        else if(challenge.metric==='risk80'&&Number(education.riskDiscipline||0)>=80)next+=1;
        else if(challenge.metric==='wins'&&verified.status==='won')next+=1;
        else if(challenge.metric==='distinctGames')next=Math.max(next,new Set([...distinctToday,gameId]).size);
        else if(challenge.metric==='cleanRuns'&&Number(verified.hits||0)===0&&Number(verified.mistakes||0)===0)next+=1;
        next=Math.min(challenge.target,next);
        const newlyCompleted=!challengeRow?.completed&&next>=challenge.target;
        if(newlyCompleted)challengeBonusXp+=challenge.rewardXp;
        await client.query(`UPDATE wisdo_arcade_daily_challenges SET progress=$4,completed=completed OR $5,completed_at=CASE WHEN NOT completed AND $5 THEN NOW() ELSE completed_at END,updated_at=NOW() WHERE user_id=$1 AND challenge_date=$2 AND challenge_id=$3`,[uid,today,challenge.id,next,newlyCompleted]);
      }

      const stats=await client.query(`SELECT COUNT(*) FILTER(WHERE status='finalized')::int AS finalized,COUNT(DISTINCT game_id) FILTER(WHERE status='finalized')::int AS distinct_games FROM wisdo_arcade_sessions WHERE user_id=$1`,[uid]);
      const masteryStats=await client.query(`SELECT COALESCE(MAX(best_mastery),0)::int AS best_mastery FROM wisdo_arcade_game_mastery WHERE user_id=$1`,[uid]);
      const totalBefore=Number(row.total_xp||0);
      let runningXp=totalBefore+baseXp+challengeBonusXp;
      let runningSeasonXp=seasonXpBefore+baseXp+challengeBonusXp;
      const preliminaryLevel=levelFromXp(runningXp);
      const candidates=achievementCandidates({
        finalized:Number(stats.rows[0]?.finalized||0),
        distinctGames:Number(stats.rows[0]?.distinct_games||0),
        streak,
        level:preliminaryLevel,
        bestMastery:Number(masteryStats.rows[0]?.best_mastery||0),
        education,
        verified,
      });
      let achievementBonusXp=0;
      const unlockedNow=[];
      for(const achievementId of candidates){
        const definition=ACHIEVEMENTS.find((item)=>item.id===achievementId);if(!definition)continue;
        const inserted=await client.query(`INSERT INTO wisdo_arcade_achievements(user_id,achievement_id,reward_xp,metadata) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(user_id,achievement_id) DO NOTHING RETURNING achievement_id`,[uid,achievementId,definition.xp,JSON.stringify({gameId,sessionId})]);
        if(inserted.rows.length){achievementBonusXp+=definition.xp;unlockedNow.push(achievementId);}
      }
      runningXp+=achievementBonusXp;runningSeasonXp+=achievementBonusXp;
      const finalLevel=levelFromXp(runningXp);
      if(finalLevel>=10&&!unlockedNow.includes('level-10')){
        const definition=ACHIEVEMENTS.find((item)=>item.id==='level-10');
        const inserted=await client.query(`INSERT INTO wisdo_arcade_achievements(user_id,achievement_id,reward_xp,metadata) VALUES($1,'level-10',$2,$3::jsonb) ON CONFLICT(user_id,achievement_id) DO NOTHING RETURNING achievement_id`,[uid,definition.xp,JSON.stringify({level:finalLevel,sessionId})]);
        if(inserted.rows.length){runningXp+=definition.xp;runningSeasonXp+=definition.xp;achievementBonusXp+=definition.xp;unlockedNow.push('level-10');}
      }

      const resolvedLevel=levelFromXp(runningXp);
      const xpAwarded=baseXp+challengeBonusXp+achievementBonusXp;
      await client.query(`UPDATE wisdo_arcade_progression SET total_xp=$2,level=$3,current_streak=$4,longest_streak=$5,last_play_date=$6,season_id=$7,season_xp=$8,updated_at=NOW() WHERE user_id=$1`,[uid,runningXp,resolvedLevel,streak,longest,today,currentSeason,runningSeasonXp]);
      await client.query(`UPDATE wisdo_arcade_progression_events SET xp_awarded=$2 WHERE session_id=$1`,[sessionId,xpAwarded]);
      await client.query('COMMIT');
      return this.profile(uid,{recent:{sessionId,gameId,baseXp,challengeBonusXp,achievementBonusXp,xpAwarded,unlockedAchievements:unlockedNow}});
    }catch(error){try{await client.query('ROLLBACK');}catch{}throw error;}finally{client.release();}
  }

  async profile(userId,{compact=false,recent=null}={}){
    await this.ensureSchema();const uid=await this.ensureUserRow(userId);await this.ensureDailyChallenges(uid);
    const [progressionResult,masteryResult,achievementResult,challengeResult,walletResult,sessionStats]=await Promise.all([
      this.pool.query(`SELECT * FROM wisdo_arcade_progression WHERE user_id=$1`,[uid]),
      this.pool.query(`SELECT game_id,xp,sessions,wins,best_score,best_mastery,mastery_tier,updated_at FROM wisdo_arcade_game_mastery WHERE user_id=$1 ORDER BY best_mastery DESC,xp DESC,game_id`,[uid]),
      this.pool.query(`SELECT achievement_id,reward_xp,metadata,unlocked_at FROM wisdo_arcade_achievements WHERE user_id=$1 ORDER BY unlocked_at DESC`,[uid]),
      this.pool.query(`SELECT challenge_id,metric,progress,target,reward_xp,completed,completed_at FROM wisdo_arcade_daily_challenges WHERE user_id=$1 AND challenge_date=$2 ORDER BY challenge_id`,[uid,utcDateKey()]),
      this.pool.query(`SELECT COALESCE(SUM(amount),0)::int AS balance,COALESCE(SUM(amount) FILTER(WHERE amount>0),0)::int AS earned_lifetime,COALESCE(SUM(amount) FILTER(WHERE amount>0 AND created_at>=date_trunc('day',NOW())),0)::int AS earned_today,COALESCE(ABS(SUM(amount) FILTER(WHERE amount<0)),0)::int AS spent_lifetime FROM wisdo_culture_coin_ledger WHERE user_id=$1`,[uid]),
      this.pool.query(`SELECT COUNT(*) FILTER(WHERE status='finalized')::int AS finalized,COUNT(DISTINCT game_id) FILTER(WHERE status='finalized')::int AS distinct_games FROM wisdo_arcade_sessions WHERE user_id=$1`,[uid]),
    ]);
    const row=progressionResult.rows[0]||{total_xp:0,level:1,current_streak:0,longest_streak:0,season_xp:0,season_id:seasonId()};
    const progress=levelProgress(Number(row.total_xp||0));const floors=floorUnlockState(progress.level);
    const challengeDefs=new Map(dailyChallenges().map((item)=>[item.id,item]));
    const achievements=achievementResult.rows.map((item)=>{const def=ACHIEVEMENTS.find((x)=>x.id===item.achievement_id);return{id:item.achievement_id,name:def?.name||item.achievement_id,description:def?.description||'',rewardXp:Number(item.reward_xp||0),unlockedAt:item.unlocked_at};});
    const challenges=challengeResult.rows.map((item)=>({id:item.challenge_id,label:challengeDefs.get(item.challenge_id)?.label||item.challenge_id,metric:item.metric,progress:Number(item.progress||0),target:Number(item.target||0),rewardXp:Number(item.reward_xp||0),completed:Boolean(item.completed),completedAt:item.completed_at}));
    const base={
      build:ARCADE_ALPHA3_BUILD,version:ARCADE_ALPHA3_VERSION,...progress,
      streak:{current:Number(row.current_streak||0),longest:Number(row.longest_streak||0),lastPlayDate:row.last_play_date||null},
      season:{id:row.season_id||seasonId(),xp:Number(row.season_xp||0)},floors,
      wallet:{currency:'CULTURE_COIN',balance:Number(walletResult.rows[0]?.balance||0),earnedLifetime:Number(walletResult.rows[0]?.earned_lifetime||0),earnedToday:Number(walletResult.rows[0]?.earned_today||0),spentLifetime:Number(walletResult.rows[0]?.spent_lifetime||0),wagering:false},
      stats:{finalized:Number(sessionStats.rows[0]?.finalized||0),distinctGames:Number(sessionStats.rows[0]?.distinct_games||0)},
      mastery:masteryResult.rows.map((item)=>({gameId:item.game_id,xp:Number(item.xp||0),sessions:Number(item.sessions||0),wins:Number(item.wins||0),bestScore:Number(item.best_score||0),bestMastery:Number(item.best_mastery||0),tier:item.mastery_tier,updatedAt:item.updated_at})),
      recent,
    };
    if(compact)return base;
    return {...base,achievements,challenges,achievementCatalog:ACHIEVEMENTS.map((item)=>({...item,unlocked:achievements.some((owned)=>owned.id===item.id)}))};
  }

  async seasonLeaderboard(limit=25){
    await this.ensureSchema();const sid=seasonId();
    const result=await this.pool.query(`SELECT user_id,season_xp,total_xp,level,current_streak FROM wisdo_arcade_progression WHERE season_id=$1 ORDER BY season_xp DESC,total_xp DESC,updated_at ASC LIMIT $2`,[sid,integer(limit,1,100,25)]);
    return result.rows.map((row,index)=>({rank:index+1,player:anonymousPlayer(row.user_id),seasonXp:Number(row.season_xp||0),totalXp:Number(row.total_xp||0),level:Number(row.level||1),streak:Number(row.current_streak||0)}));
  }

  async health(){
    await this.ensureSchema();
    const counts=await this.pool.query(`SELECT (SELECT COUNT(*) FROM wisdo_arcade_progression)::int AS players,(SELECT COUNT(*) FROM wisdo_arcade_progression_events)::int AS events,(SELECT COUNT(*) FROM wisdo_arcade_achievements)::int AS achievements`);
    return{ok:true,service:'wisdo-arcade-progression',build:ARCADE_ALPHA3_BUILD,version:ARCADE_ALPHA3_VERSION,players:Number(counts.rows[0]?.players||0),verifiedProgressionEvents:Number(counts.rows[0]?.events||0),achievementsUnlocked:Number(counts.rows[0]?.achievements||0),floorLevels:FLOOR_LEVELS,wagering:false};
  }
}
