import crypto from 'node:crypto';

function clean(value = '', max = 4000) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}
function clamp(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}
function slug(value = 'voice') {
  return clean(value, 120).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'voice';
}
function tokens(text) { return new Set(clean(text).toLowerCase().split(/[^a-z0-9']+/).filter(Boolean)); }
const REAL_PERSON_HINTS = ['michael jackson','marvin sapp','james earl jones','morgan freeman','barack obama','donald trump','beyonce','prince'];
const BASE_VOICES = ['cedar','onyx','ballad','sage','echo','verse','ash','coral','marin'];

function traitScore(words, positives, fallback) {
  return positives.some((word) => words.has(word)) ? 88 : fallback;
}
function deriveName(description, traits) {
  const lower = description.toLowerCase();
  if (lower.includes('new orleans') || lower.includes('louisiana') || lower.includes('gulf south')) return 'Crescent Sage';
  if (traits.accent === 'british') return traits.warmth > 80 ? 'London Shepherd' : 'British Sovereign';
  if (traits.authority > 85 && traits.age_impression === 'elder') return 'Elder Sovereign';
  if (traits.warmth > 85) return 'Warm Guide';
  return 'Wisdo Presence';
}
function chooseProviderVoice(traits, variation='balanced') {
  if (variation === 'deeper') return 'onyx';
  if (variation === 'warmer') return 'ballad';
  if (traits.register === 'deep_baritone') return 'cedar';
  if (traits.energy > 70) return 'echo';
  return 'sage';
}
function buildInstructions(profile) {
  const t=profile.traits;
  const lines=[
    `Speak as an original ${t.age_impression === 'elder' ? 'mature elder' : 'adult'} ${t.presentation} voice.`,
    `Use a ${t.register.replaceAll('_',' ')} register with ${t.cadence.replaceAll('_',' ')} cadence.`,
    `Warmth ${t.warmth}/100, authority ${t.authority}/100, energy ${t.energy}/100, naturalness ${t.naturalness}/100.`,
    `Use ${t.pause_style.replaceAll('_',' ')} pauses and natural breath timing.`,
    `Accent influence: ${t.accent.replaceAll('_',' ')}. Dialect influence: ${t.dialect.replaceAll('_',' ')}.`,
    `Slang intensity is ${t.slang_intensity}; use it only in ${t.slang_context.replaceAll('_',' ')} contexts and never force it into every sentence.`,
    'Keep financial alerts, account values, broker symbols, and emergency warnings precise and unambiguous.',
    'Never sound robotic, theatrical, exaggerated, comedic, or like an announcer.',
    'Maintain an original identity and never claim to be or closely imitate a real person.',
  ];
  return lines.join(' ');
}
function localCompile(description, ownerUserId) {
  const text=clean(description); const lower=text.toLowerCase(); const words=tokens(text);
  const requestedRealPerson=REAL_PERSON_HINTS.find((name)=>lower.includes(name)) || null;
  const traits={
    age_impression: /old|older|elder|seasoned|mature|old head/.test(lower)?'elder':'adult',
    presentation: /female|woman|lady/.test(lower)?'female':'male',
    register: /deep|baritone|bass|low voice/.test(lower)?'deep_baritone':'mid_baritone',
    accent: /british|uk|london/.test(lower)?'british':(/new orleans|louisiana|gulf south|southern/.test(lower)?'gulf_south':'neutral_american'),
    dialect: /new orleans|louisiana|gulf south/.test(lower)?'new_orleans_gulf_south':(/southern/.test(lower)?'southern_us':'neutral'),
    cadence: /slow|patient|deliberate|unhurried/.test(lower)?'slow_deliberate':(/quick|fast/.test(lower)?'concise_fast':'natural_measured'),
    pause_style: /pause|deliberate|wise|guru|mentor/.test(lower)?'meaningful_long':'natural',
    warmth: traitScore(words,['warm','soulful','gentle','kind','comforting'],74),
    authority: traitScore(words,['leader','authority','commanding','powerful','strong'],78),
    energy: /calm|slow|relaxed|laid back|laid-back/.test(lower)?35:(/energetic|hype|excited/.test(lower)?82:52),
    naturalness: /not robotic|natural|human|real/.test(lower)?98:92,
    slang_intensity: /heavy slang|strong slang/.test(lower)?'strong':(/slang|street|local phrases/.test(lower)?'light':'none'),
    slang_context: /trading slang|everywhere/.test(lower)?'all_non_emergency':'casual_only',
  };
  const base={
    profile_id: crypto.randomUUID(), owner_user_id: ownerUserId, name: deriveName(text,traits), description:text,
    source_type:'conversational_design', identity:{type:'original_style_designed', imitation:false, requested_real_person:requestedRealPerson},
    traits, speed: traits.cadence==='slow_deliberate'?0.76:(traits.cadence==='concise_fast'?1.02:0.9), status:'draft', version:1,
    safety:{consent_required:false, celebrity_imitation_blocked:Boolean(requestedRealPerson), financial_precision:true, emergency_clarity:true},
  };
  const variants=[
    {...base, profile_id:crypto.randomUUID(), name:`${base.name} — Balanced`, variation:'balanced'},
    {...base, profile_id:crypto.randomUUID(), name:`${base.name} — Deeper`, variation:'deeper', speed:Math.max(.55,base.speed-.04), traits:{...traits,authority:Math.min(100,traits.authority+8),energy:Math.max(20,traits.energy-8)}},
    {...base, profile_id:crypto.randomUUID(), name:`${base.name} — Warmer`, variation:'warmer', speed:Math.min(1.1,base.speed+.03), traits:{...traits,warmth:Math.min(100,traits.warmth+10),authority:Math.max(50,traits.authority-5)}},
  ].map((p)=>({...p,provider:'openai',provider_voice:chooseProviderVoice(p.traits,p.variation),instructions:buildInstructions(p)}));
  return {summary:`I created three original voice directions from your description: balanced, deeper, and warmer.`, clarification:null, requested_real_person:requestedRealPerson, variants};
}

export class WisdoVoiceCreatorService {
  constructor({pool, logger=console}={}) { this.pool=pool; this.logger=logger; this.designModel=clean(process.env.WISDO_VOICE_DESIGN_MODEL || ''); this.apiKey=clean(process.env.OPENAI_API_KEY || ''); }
  async compile(ownerUserId, description) { return localCompile(description, ownerUserId); }
  async save(ownerUserId, profile, {status='draft'}={}) {
    const p={...profile, profile_id:clean(profile.profile_id,100)||crypto.randomUUID(), owner_user_id:ownerUserId};
    const result=await this.pool.query(`INSERT INTO wisdo_voice_genomes
      (voice_id,owner_user_id,name,source_type,identity,vocal_character,delivery,consent,assignments,status,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,'[]'::jsonb,$9,NOW(),NOW())
      ON CONFLICT(voice_id) DO UPDATE SET name=EXCLUDED.name,identity=EXCLUDED.identity,vocal_character=EXCLUDED.vocal_character,delivery=EXCLUDED.delivery,consent=EXCLUDED.consent,status=EXCLUDED.status,updated_at=NOW()
      RETURNING *`,[p.profile_id,ownerUserId,clean(p.name,200),clean(p.source_type,80)||'conversational_design',JSON.stringify(p.identity||{}),JSON.stringify({...p.traits,description:p.description,provider:p.provider,provider_voice:p.provider_voice,instructions:p.instructions}),JSON.stringify({speed:p.speed,variation:p.variation}),JSON.stringify(p.safety||{}),status]);
    const version=Number(profile.version||1);
    await this.pool.query(`INSERT INTO wisdo_voice_versions(voice_id,version,definition,change_summary,created_by,created_at)
      VALUES($1,$2,$3::jsonb,$4,$5,NOW()) ON CONFLICT(voice_id,version) DO UPDATE SET definition=EXCLUDED.definition,change_summary=EXCLUDED.change_summary`,
      [p.profile_id,version,JSON.stringify(p),clean(profile.change_summary||'Created from conversation',500),ownerUserId]);
    return result.rows[0];
  }
  async design(device, input={}) {
    const compiled=await this.compile(device.owner_user_id,input.description||input.text||'');
    const saved=[]; for(const profile of compiled.variants) saved.push(await this.save(device.owner_user_id,profile));
    return {...compiled,variants:saved.map((row,i)=>({...compiled.variants[i],db_status:row.status}))};
  }
  async list(ownerUserId) {
    const r=await this.pool.query(`SELECT voice_id,name,source_type,identity,vocal_character,delivery,consent,assignments,status,created_at,updated_at FROM wisdo_voice_genomes WHERE owner_user_id=$1 ORDER BY updated_at DESC`,[ownerUserId]); return r.rows;
  }
  async get(ownerUserId,voiceId) {
    const r=await this.pool.query(`SELECT * FROM wisdo_voice_genomes WHERE owner_user_id=$1 AND voice_id=$2 LIMIT 1`,[ownerUserId,voiceId]); return r.rows[0]||null;
  }
  rowToProfile(row) {
    if(!row)return null; const vc=row.vocal_character||{}; const d=row.delivery||{};
    return {profile_id:row.voice_id,name:row.name,identity:row.identity||{},traits:vc,provider:vc.provider||'openai',provider_voice:vc.provider_voice||'cedar',instructions:vc.instructions||'',speed:Number(d.speed||.82),status:row.status};
  }
  async refine(device, voiceId, instruction) {
    const row=await this.get(device.owner_user_id,voiceId); if(!row){const e=new Error('Voice profile not found.');e.statusCode=404;throw e;}
    const p=this.rowToProfile(row); const lower=clean(instruction).toLowerCase();
    if(/deeper|lower/.test(lower)){p.traits.register='deep_baritone';p.traits.authority=clamp(Number(p.traits.authority)+8,0,100,86);p.provider_voice='onyx';}
    if(/warmer|friendlier|softer/.test(lower)){p.traits.warmth=clamp(Number(p.traits.warmth)+10,0,100,90);p.provider_voice='ballad';}
    if(/slower|slow down/.test(lower))p.speed=clamp(p.speed-.08,.25,4,.76);
    if(/faster|speed up/.test(lower))p.speed=clamp(p.speed+.08,.25,4,.94);
    if(/less slang|stop.*slang/.test(lower))p.traits.slang_intensity='none';
    if(/more slang/.test(lower))p.traits.slang_intensity='light';
    if(/less serious|relaxed/.test(lower)){p.traits.authority=clamp(Number(p.traits.authority)-8,0,100,70);p.traits.energy=clamp(Number(p.traits.energy)-4,0,100,40);}
    p.instructions=buildInstructions(p); p.version=await this.nextVersion(voiceId); p.change_summary=instruction;
    await this.save(device.owner_user_id,p,{status:'draft'}); return p;
  }
  async nextVersion(voiceId){const r=await this.pool.query(`SELECT COALESCE(MAX(version),0)+1 AS next FROM wisdo_voice_versions WHERE voice_id=$1`,[voiceId]);return Number(r.rows[0].next);}
  async activate(device,voiceId,scope={type:'user_default'}) {
    const row=await this.get(device.owner_user_id,voiceId); if(!row){const e=new Error('Voice profile not found.');e.statusCode=404;throw e;}
    await this.pool.query(`UPDATE wisdo_voice_assignments SET status='inactive',updated_at=NOW() WHERE owner_user_id=$1 AND scope_type=$2 AND scope_id=$3 AND status='active'`,[device.owner_user_id,clean(scope.type,80)||'user_default',clean(scope.id,200)||device.owner_user_id]);
    const assignmentId=crypto.randomUUID();
    await this.pool.query(`INSERT INTO wisdo_voice_assignments(assignment_id,owner_user_id,voice_id,scope_type,scope_id,priority,status,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,'active',NOW(),NOW())`,[assignmentId,device.owner_user_id,voiceId,clean(scope.type,80)||'user_default',clean(scope.id,200)||device.owner_user_id,Number(scope.priority||100)]);
    await this.pool.query(`UPDATE wisdo_voice_genomes SET status='active',updated_at=NOW() WHERE voice_id=$1`,[voiceId]);
    await this.pool.query(`INSERT INTO wisdo_voice_events(event_id,owner_user_id,voice_id,event_type,payload,created_at) VALUES($1,$2,$3,'activated',$4::jsonb,NOW())`,[crypto.randomUUID(),device.owner_user_id,voiceId,JSON.stringify({scope,source_device:device.device_id})]);
    return {ok:true,voice_id:voiceId,assignment_id:assignmentId,scope};
  }
  async active(device,scopeType='user_default',scopeId='') {
    const r=await this.pool.query(`SELECT a.*,g.name,g.vocal_character,g.delivery,g.identity FROM wisdo_voice_assignments a JOIN wisdo_voice_genomes g ON g.voice_id=a.voice_id
      WHERE a.owner_user_id=$1 AND a.status='active' AND a.scope_type=$2 AND a.scope_id=$3 ORDER BY a.priority DESC,a.updated_at DESC LIMIT 1`,[device.owner_user_id,scopeType,scopeId||device.owner_user_id]); return r.rows[0]||null;
  }
  async conversation(device,input={}) {
    const text=clean(input.text||input.description); const lower=text.toLowerCase();
    if(/^(that'?s it|perfect|use (that|this|the)|make (that|this) (my )?(default|main)|activate)/.test(lower)){
      const voiceId=clean(input.voice_id||input.context_voice_id,100); if(!voiceId){return {action:'clarify',reply:'Which preview should I make your default voice?'}}
      const active=await this.activate(device,voiceId,input.scope||{type:'user_default'}); return {action:'activated',reply:'Done. This voice is now active and will synchronize to your authorized Wisdo devices.',...active};
    }
    if(/deeper|warmer|slower|faster|slang|serious|relaxed/.test(lower) && input.voice_id){const profile=await this.refine(device,input.voice_id,text);return {action:'preview',reply:'I updated the voice from your correction. Previewing the new version.',profile,preview_voice_id:profile.profile_id};}
    const result=await this.design(device,{description:text}); return {action:'choose_preview',reply:result.summary,variants:result.variants,preview_voice_id:result.variants[0]?.profile_id};
  }
}
