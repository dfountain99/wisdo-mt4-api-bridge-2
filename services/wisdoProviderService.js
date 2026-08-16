const INTENT_OUTPUT_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'type', 'intent', 'commandName', 'confidence', 'parameters'],
  properties: {
    schemaVersion: { type: 'string' },
    type: { type: 'string', enum: ['ACTION', 'QUERY', 'PLAN', 'CONVERSATION', 'CONFIRMATION', 'CANCEL', 'GOODBYE', 'CLARIFICATION'] },
    intent: { type: 'string', minLength: 1 },
    commandName: { type: ['string', 'null'], enum: [null, 'CLOSE_ALL_TRADES', 'CLOSE_ALL_WINNERS', 'CLOSE_ALL_LOSERS', 'EMERGENCY_STOP', 'PAUSE_COPIER', 'RESUME_COPIER', 'STOP_ENTRIES', 'START_ENTRIES', 'SET_EQUITY_FLOOR'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['accountId', 'botId', 'symbol', 'value', 'percent'],
      properties: {
        accountId: { type: ['string', 'null'] },
        botId: { type: ['string', 'null'] },
        symbol: { type: ['string', 'null'] },
        value: { type: ['number', 'null'] },
        percent: { type: ['number', 'null'] },
      },
    },
  },
});

export class WisdoProviderService {
  constructor({ fetchImpl = globalThis.fetch } = {}) {
    this.fetch = fetchImpl;
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.model = process.env.WISDO_CONVERSATION_MODEL || 'gpt-5.6-luna';
  }

  configured() { return Boolean(this.apiKey); }

  async extractIntent({ text, context, schemaVersion }) {
    if (!this.configured()) return null;
    const response = await this.fetch('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, input: [{ role: 'system', content: `Extract one intent using schema ${schemaVersion}. Never return code or an MT4 command not supported by the supplied context.` }, { role: 'user', content: JSON.stringify({ text, context }) }], text: { format: { type: 'json_schema', name: 'wisdo_intent', strict: true, schema: INTENT_OUTPUT_SCHEMA } } }),
      signal: AbortSignal.timeout(Number(process.env.WISDO_AI_TIMEOUT_MS || 15000)),
    });
    if (!response.ok) throw new Error(`Conversation provider failed with HTTP ${response.status}.`);
    const body = await response.json();
    const output = body.output_text || body.output?.flatMap((o) => o.content || []).find((c) => c.type === 'output_text')?.text;
    return output ? JSON.parse(output) : null;
  }

  async respond({ text, context={}, recent=[] }) {
    if(!this.configured())return null;
    const now=new Date().toISOString();
    const response=await this.fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${this.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:this.model,input:[{role:'system',content:`You are WISDO, a capable general AI assistant, patient teacher, and trading operations coach. The current UTC time is ${now}. Answer ordinary questions directly, teach concepts step by step, use recent conversation for continuity, and clearly distinguish facts from uncertainty. You may discuss any lawful topic. Never claim to execute trading actions yourself, never bypass confirmations, and never invent private account facts; use only supplied authorized context.`},...recent.slice(-16).map((m)=>({role:m.role==='assistant'?'assistant':'user',content:String(m.content||'')})),{role:'user',content:String(text||'')}],metadata:{wisdo_mode:'conversation'}}),signal:AbortSignal.timeout(Number(process.env.WISDO_AI_TIMEOUT_MS||30000))});
    if(!response.ok)throw new Error(`Conversation provider failed with HTTP ${response.status}.`);const body=await response.json();return String(body.output_text||body.output?.flatMap((o)=>o.content||[]).find((c)=>c.type==='output_text')?.text||'').trim()||null;
  }

  async transcribeAudio({ audio, filename='speech.wav', model=process.env.WISDO_STT_MODEL||'gpt-4o-mini-transcribe' }) {
    if(!this.configured())throw Object.assign(new Error('Speech-to-text provider is not configured.'),{code:'speech_provider_unconfigured'});
    const form=new FormData();form.append('model',model);form.append('file',new Blob([audio]),filename);
    const response=await this.fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${this.apiKey}`},body:form,signal:AbortSignal.timeout(Number(process.env.WISDO_STT_TIMEOUT_MS||45000))});
    if(!response.ok)throw new Error(`Speech-to-text provider failed with HTTP ${response.status}.`);return response.json();
  }

  async synthesizeSpeech({ text, voice=process.env.WISDO_SPEECH_VOICE||'cedar', model=process.env.WISDO_TTS_MODEL||'gpt-4o-mini-tts' }) {
    if(!this.configured())throw Object.assign(new Error('Text-to-speech provider is not configured.'),{code:'speech_provider_unconfigured'});
    const response=await this.fetch('https://api.openai.com/v1/audio/speech',{method:'POST',headers:{Authorization:`Bearer ${this.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model,voice,input:String(text||''),response_format:'wav'}),signal:AbortSignal.timeout(Number(process.env.WISDO_TTS_TIMEOUT_MS||45000))});
    if(!response.ok)throw new Error(`Text-to-speech provider failed with HTTP ${response.status}.`);return {audio:Buffer.from(await response.arrayBuffer()),contentType:response.headers.get('content-type')||'audio/wav'};
  }
}
