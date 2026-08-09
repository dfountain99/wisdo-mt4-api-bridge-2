import { createHash, randomUUID } from 'node:crypto';

const AUDIO_TYPES = new Set(['audio/wav','audio/x-wav','audio/flac','audio/mpeg','audio/mp3','audio/ogg','audio/webm','audio/mp4','audio/m4a']);
const PLAYBACK_STATES = new Set(['DELIVERED','PLAYING','PLAYED','FAILED','CANCELLED']);
function error(message, code, statusCode = 400) { return Object.assign(new Error(message), { code, statusCode }); }
function clean(value, max = 500) { return String(value || '').trim().slice(0, max); }
function decodeAudio(value) {
  const input = String(value || '').replace(/\s/g, '');
  if (!input || input.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(input)) throw error('A valid base64 audio payload is required.','invalid_audio');
  return Buffer.from(input, 'base64');
}
function detectedAudioType(audio){if(audio.length>=12&&audio.subarray(0,4).toString()==='RIFF'&&audio.subarray(8,12).toString()==='WAVE')return 'wav';if(audio.subarray(0,4).toString()==='fLaC')return 'flac';if(audio.subarray(0,4).toString()==='OggS')return 'ogg';if(audio.length>=4&&audio[0]===0x1a&&audio[1]===0x45&&audio[2]===0xdf&&audio[3]===0xa3)return 'webm';if(audio.subarray(0,3).toString()==='ID3'||(audio[0]===0xff&&(audio[1]&0xe0)===0xe0))return 'mp3';if(audio.length>=12&&audio.subarray(4,8).toString()==='ftyp')return 'mp4';return null;}
function contentMatches(contentType,detected){return ({'audio/wav':'wav','audio/x-wav':'wav','audio/flac':'flac','audio/ogg':'ogg','audio/webm':'webm','audio/mpeg':'mp3','audio/mp3':'mp3','audio/mp4':'mp4','audio/m4a':'mp4'})[contentType]===detected;}

export class WisdoAudioService {
  constructor({ pool, provider, conversationService, logger = console } = {}) {
    Object.assign(this, { pool, provider, conversationService, logger });
    this.maxAudioBytes = Math.max(64 * 1024, Math.min(4 * 1024 * 1024, Number(process.env.WISDO_AUDIO_MAX_BYTES || 1_500_000)));
    this.maxDurationMs = Math.max(1000, Math.min(120000, Number(process.env.WISDO_AUDIO_MAX_DURATION_MS || 45000)));
    this.deliveryTtlSeconds = Math.max(30, Math.min(3600, Number(process.env.WISDO_SPEECH_TTL_MS || 300000) / 1000));
    this.offerLeaseSeconds = Math.max(5, Math.min(120, Number(process.env.WISDO_SPEECH_OFFER_LEASE_MS || 30000) / 1000));
    this.maxDeliveryBytes = Math.max(64 * 1024, Math.min(4 * 1024 * 1024, Number(process.env.WISDO_TTS_MAX_BYTES || 1_500_000)));
    this.maxUtterancesPerMinute=Math.max(1,Math.min(120,Number(process.env.WISDO_AUDIO_UPLOADS_PER_MINUTE||12)));
    this.maxPendingDeliveries=Math.max(1,Math.min(100,Number(process.env.WISDO_SPEECH_MAX_PENDING_PER_DEVICE||20)));
  }

  async submit(device, input = {}) {
    const idempotencyKey = clean(input.idempotencyKey, 200);
    if (!idempotencyKey) throw error('idempotencyKey is required.','idempotency_required');
    const contentType = clean(input.contentType, 100).toLowerCase().split(';')[0];
    if (!AUDIO_TYPES.has(contentType)) throw error('Unsupported audio content type.','unsupported_audio_type',415);
    const durationMs = Math.round(Number(input.durationMs || 0));
    if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > this.maxDurationMs) throw error('Audio duration is outside the configured limit.','audio_duration_limit',413);
    const audio = decodeAudio(input.audioBase64);
    if (!audio.length || audio.length > this.maxAudioBytes) throw error('Audio payload is outside the configured size limit.','audio_size_limit',413);
    if(!contentMatches(contentType,detectedAudioType(audio)))throw error('Audio bytes do not match the declared content type.','audio_content_mismatch',415);
    const existing = await this.pool.query(`SELECT * FROM wisdo_voice_utterances WHERE device_id=$1 AND idempotency_key=$2 LIMIT 1`,[device.device_id,idempotencyKey]);
    if (existing.rows[0]) return { duplicate: true, utterance: existing.rows[0], result: existing.rows[0].response || null };
    const rate=await this.pool.query(`SELECT count(*)::int count FROM wisdo_voice_utterances WHERE device_id=$1 AND created_at>NOW()-INTERVAL '1 minute'`,[device.device_id]);
    if(Number(rate.rows[0]?.count||0)>=this.maxUtterancesPerMinute)throw error('Voice upload rate limit exceeded.','audio_rate_limited',429);
    const utteranceId = randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.pool.query(`INSERT INTO wisdo_voice_utterances(utterance_id,owner_user_id,device_id,room_id,session_id,idempotency_key,status,content_type,audio_size_bytes,duration_ms,expires_at) VALUES($1,$2,$3,$4,$5,$6,'RECEIVED',$7,$8,$9,$10)`,[utteranceId,device.owner_user_id,device.device_id,clean(input.roomId,200)||null,input.sessionId||null,idempotencyKey,contentType,audio.length,durationMs,expiresAt]);
    try {
      await this.pool.query(`UPDATE wisdo_voice_utterances SET status='PROCESSING',updated_at=NOW() WHERE utterance_id=$1`,[utteranceId]);
      const transcription = await this.provider.transcribeAudio({ audio, filename:`utterance.${contentType.includes('flac')?'flac':contentType.includes('webm')?'webm':contentType.includes('mpeg')||contentType.includes('mp3')?'mp3':'wav'}` });
      const transcript = clean(transcription?.text, 4000);
      if (!transcript) throw error('The transcription provider returned no speech.','empty_transcription',422);
      const confidence = Number(transcription?.confidence);
      const result = await this.conversationService.answer({ userId:device.owner_user_id, deviceId:device.device_id, channel:'device', sessionId:input.sessionId||null, text:transcript, accountId:input.accountId||null });
      await this.pool.query(`UPDATE wisdo_voice_utterances SET status='COMPLETED',session_id=COALESCE($2,session_id),transcript=$3,transcription_confidence=$4,response=$5::jsonb,updated_at=NOW() WHERE utterance_id=$1`,[utteranceId,result.sessionId||null,transcript,Number.isFinite(confidence)?confidence:null,JSON.stringify(result)]);
      let delivery = null; let speechError = null;
      if (result.text) try { delivery = await this.queueSpeech(device,{sessionId:result.sessionId,utteranceId,text:result.text,priority:input.priority,idempotencyKey:`utterance:${utteranceId}:response`}); } catch (cause) { speechError={code:cause.code||'tts_unavailable',message:'Cloud speech is unavailable; use the returned text response.'}; this.logger.warn?.('Voice response TTS unavailable',{utteranceId,deviceId:device.device_id,code:cause.code,message:cause.message}); }
      return { duplicate:false, utteranceId, transcript, confidence:Number.isFinite(confidence)?confidence:null, result, deliveryId:delivery?.delivery_id||null, speechError };
    } catch (cause) {
      await this.pool.query(`UPDATE wisdo_voice_utterances SET status='FAILED',error_code=$2,error_message=$3,updated_at=NOW() WHERE utterance_id=$1`,[utteranceId,clean(cause.code||'processing_failed',100),clean(cause.message,1000)]).catch(()=>undefined);
      throw cause;
    }
  }

  async queueSpeech(device,{sessionId=null,utteranceId=null,text,priority=50,idempotencyKey}={}) {
    const speechText=clean(text,4000); if(!speechText)return null;
    const requestedPriority=Math.max(0,Math.min(100,Number(priority||50)));
    const pending=await this.pool.query(`SELECT count(*)::int count FROM wisdo_speech_deliveries WHERE device_id=$1 AND owner_user_id=$2 AND status IN ('QUEUED','OFFERED','DELIVERED','PLAYING') AND expires_at>NOW()`,[device.device_id,device.owner_user_id]);
    if(Number(pending.rows[0]?.count||0)>=this.maxPendingDeliveries){if(requestedPriority<90)throw error('The device speech queue is full.','speech_queue_full',429);await this.pool.query(`UPDATE wisdo_speech_deliveries SET status='EXPIRED',audio_data=NULL,error_code='preempted_by_urgent',updated_at=NOW() WHERE delivery_id=(SELECT delivery_id FROM wisdo_speech_deliveries WHERE device_id=$1 AND owner_user_id=$2 AND status IN ('QUEUED','OFFERED') ORDER BY priority,created_at LIMIT 1)`,[device.device_id,device.owner_user_id]);}
    const synthesized=await this.provider.synthesizeSpeech({text:speechText});
    const audio=Buffer.from(synthesized.audio||[]); const contentType=clean(synthesized.contentType,100).toLowerCase().split(';')[0];
    if(!AUDIO_TYPES.has(contentType)||!audio.length||audio.length>this.maxDeliveryBytes||!contentMatches(contentType,detectedAudioType(audio)))throw error('Generated speech failed content-type, signature, or size validation.','invalid_tts_audio',502);
    const key=clean(idempotencyKey||createHash('sha256').update(`${device.device_id}:${sessionId}:${speechText}`).digest('hex'),200);
    const r=await this.pool.query(`INSERT INTO wisdo_speech_deliveries(delivery_id,owner_user_id,device_id,session_id,utterance_id,idempotency_key,priority,status,response_text,content_type,audio_data,audio_size_bytes,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,'QUEUED',$8,$9,$10,$11,NOW()+($12||' seconds')::interval) ON CONFLICT(device_id,idempotency_key) DO UPDATE SET updated_at=wisdo_speech_deliveries.updated_at RETURNING *`,[randomUUID(),device.owner_user_id,device.device_id,sessionId,utteranceId,key,requestedPriority,speechText,contentType,audio,audio.length,String(this.deliveryTtlSeconds)]);
    return r.rows[0];
  }

  async offer(device) {
    const client=await this.pool.connect();
    try { await client.query('BEGIN');
      await client.query(`UPDATE wisdo_speech_deliveries SET status='EXPIRED',audio_data=NULL,updated_at=NOW() WHERE device_id=$1 AND expires_at<=NOW() AND status NOT IN ('PLAYED','FAILED','CANCELLED','EXPIRED')`,[device.device_id]);
      const r=await client.query(`SELECT * FROM wisdo_speech_deliveries WHERE device_id=$1 AND owner_user_id=$2 AND expires_at>NOW() AND (status='QUEUED' OR (status='OFFERED' AND offer_expires_at<NOW())) ORDER BY priority DESC,created_at FOR UPDATE SKIP LOCKED LIMIT 1`,[device.device_id,device.owner_user_id]);
      const row=r.rows[0]; if(!row){await client.query('COMMIT');return null;}
      const updated=await client.query(`UPDATE wisdo_speech_deliveries SET status='OFFERED',attempts=attempts+1,offer_expires_at=NOW()+($2||' seconds')::interval,updated_at=NOW() WHERE delivery_id=$1 RETURNING *`,[row.delivery_id,String(this.offerLeaseSeconds)]);
      await client.query('COMMIT'); return updated.rows[0];
    } catch(cause){await client.query('ROLLBACK');throw cause;} finally{client.release();}
  }

  async receipt(device,deliveryId,status,input={}) {
    const next=String(status||'').toUpperCase(); if(!PLAYBACK_STATES.has(next))throw error('Invalid playback receipt state.','invalid_playback_state');
    const existing=await this.pool.query(`SELECT * FROM wisdo_speech_deliveries WHERE delivery_id=$1 AND device_id=$2 AND owner_user_id=$3`,[deliveryId,device.device_id,device.owner_user_id]);const prior=existing.rows[0];if(!prior)throw error('Speech delivery was not found for this device.','delivery_not_found',404);if(prior.status===next)return prior;const allowed={OFFERED:['DELIVERED','FAILED','CANCELLED'],DELIVERED:['PLAYING','FAILED','CANCELLED'],PLAYING:['PLAYED','FAILED','CANCELLED']}[prior.status]||[];if(!allowed.includes(next))throw error(`Invalid playback transition ${prior.status} to ${next}.`,'invalid_playback_transition',409);
    const timestamps={DELIVERED:'delivered_at',PLAYING:'playback_started_at',PLAYED:'played_at'};
    const column=timestamps[next];
    const r=await this.pool.query(`UPDATE wisdo_speech_deliveries SET status=$1,${column?`${column}=NOW(),`:''} error_code=$2,error_message=$3,audio_data=CASE WHEN $1 IN ('PLAYED','FAILED','CANCELLED') THEN NULL ELSE audio_data END,updated_at=NOW() WHERE delivery_id=$4 AND device_id=$5 AND owner_user_id=$6 AND status=$7 RETURNING *`,[next,clean(input.errorCode,100)||null,clean(input.errorMessage,1000)||null,deliveryId,device.device_id,device.owner_user_id,prior.status]);
    if(!r.rows[0])throw error('Speech delivery was not found for this device.','delivery_not_found',404);
    await this.pool.query(`UPDATE wisdo_voice_devices SET led_state=$3,current_delivery_id=CASE WHEN $3='speaking' THEN $4::uuid ELSE NULL END,updated_at=NOW() WHERE device_id=$1 AND owner_user_id=$2`,[device.device_id,device.owner_user_id,next==='PLAYING'?'speaking':next==='FAILED'?'error':'idle',deliveryId]);
    return r.rows[0];
  }

  async queueCommandCompletion({ownerUserId,deviceId,commandId,success,message}) {
    if(!deviceId)return null;
    const r=await this.pool.query(`SELECT * FROM wisdo_voice_devices WHERE device_id=$1 AND owner_user_id=$2 LIMIT 1`,[deviceId,ownerUserId]);
    const device=r.rows[0]; if(!device)return null;
    const text=success?`MT4 verified the command as complete. ${clean(message,500)}`:`MT4 reported that the command failed. ${clean(message,500)}`;
    return this.queueSpeech(device,{text,priority:success?70:90,idempotencyKey:`command:${commandId}:${success?'completed':'failed'}`});
  }

  async cleanup(){return this.pool.query(`DELETE FROM wisdo_voice_utterances WHERE expires_at<NOW(); DELETE FROM wisdo_speech_deliveries WHERE expires_at<NOW() AND status IN ('PLAYED','FAILED','CANCELLED','EXPIRED')`);}
}
