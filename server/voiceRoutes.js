const DEFAULT_PROFILES = Object.freeze({
  sovereign: {
    id: 'sovereign',
    display_name: 'Wisdo Sovereign',
    description: 'Deep, mature, patient mentor presence with deliberate pauses.',
    provider: 'openai',
    voice: 'cedar',
    speed: 0.82,
    instructions: [
      'Speak as an original mature Black male mentor and community leader.',
      'Use a deep baritone presence, patient wisdom, calm authority, warmth, and deliberate pacing.',
      'Use natural pauses between important thoughts.',
      'Never imitate, claim to be, or closely reproduce any real public figure.',
      'Avoid theatrical exaggeration and avoid sounding like an announcer.',
      'Pronounce financial figures and trading symbols precisely.',
    ].join(' '),
  },
  shepherd: {
    id: 'shepherd',
    display_name: 'Wisdo Shepherd',
    description: 'Warm, grounded, encouraging and reflective.',
    provider: 'openai',
    voice: 'ballad',
    speed: 0.88,
    instructions: 'Speak warmly and patiently with grounded encouragement, natural pauses, and a mature original identity. Do not imitate a real person.',
  },
  sentinel: {
    id: 'sentinel',
    display_name: 'Wisdo Sentinel',
    description: 'Minimal, serious risk and emergency voice.',
    provider: 'openai',
    voice: 'onyx',
    speed: 0.9,
    instructions: 'Speak with concise, serious authority. Use short sentences. Make risk warnings unmistakable. Maintain an original identity and do not imitate a real person.',
  },
  professor: {
    id: 'professor',
    display_name: 'Wisdo Professor',
    description: 'Clear, patient teaching voice.',
    provider: 'openai',
    voice: 'sage',
    speed: 0.92,
    instructions: 'Speak like a patient expert teacher. Explain clearly, pronounce technical terms carefully, and use natural pauses. Maintain an original identity.',
  },
  commander: {
    id: 'commander',
    display_name: 'Wisdo Commander',
    description: 'Fast, concise trading operations voice.',
    provider: 'openai',
    voice: 'echo',
    speed: 1.02,
    instructions: 'Speak concisely and decisively for trading operations. Use brief sentences, precise numbers, and no unnecessary motivational language. Maintain an original identity.',
  },
});

function clean(value = '') {
  return String(value ?? '').trim();
}

function bearer(req) {
  const value = clean(req.headers.authorization);
  return value.toLowerCase().startsWith('bearer ') ? value.slice(7).trim() : '';
}

export class WisdoVoiceService {
  constructor({ logger } = {}) {
    this.logger = logger || console;
    this.apiKey = clean(process.env.OPENAI_API_KEY);
    this.model = clean(process.env.WISDO_TTS_MODEL || 'gpt-4o-mini-tts');
    this.defaultProfile = clean(process.env.WISDO_DEFAULT_VOICE_PROFILE || 'sovereign').toLowerCase();
  }

  profiles() {
    return Object.values(DEFAULT_PROFILES).map((profile) => ({ ...profile }));
  }

  resolveProfile(input = {}) {
    const requested = clean(input.profile || this.defaultProfile).toLowerCase();
    const base = DEFAULT_PROFILES[requested] || DEFAULT_PROFILES.sovereign;
    const speed = Number(input.speed ?? base.speed);
    return {
      ...base,
      voice: clean(input.voice || base.voice),
      speed: Number.isFinite(speed) ? Math.max(0.25, Math.min(speed, 4)) : base.speed,
      instructions: clean(input.instructions || base.instructions),
    };
  }

  async synthesize(input = {}) {
    if (!this.apiKey) {
      const error = new Error('OPENAI_API_KEY is not configured for natural cloud speech.');
      error.code = 'voice_provider_unconfigured';
      throw error;
    }
    const text = clean(input.text);
    if (!text) throw new Error('Speech text is required.');
    if (text.length > 4096) throw new Error('Speech text exceeds 4096 characters.');

    const profile = this.resolveProfile(input);
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        voice: profile.voice,
        input: text,
        instructions: profile.instructions,
        response_format: 'wav',
        speed: profile.speed,
      }),
      signal: AbortSignal.timeout(Number(process.env.WISDO_TTS_TIMEOUT_MS || 45000)),
    });

    if (!response.ok) {
      const details = await response.text();
      const error = new Error(`Voice provider failed (${response.status}): ${details.slice(0, 500)}`);
      error.status = response.status;
      throw error;
    }

    return {
      audio: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get('content-type') || 'audio/wav',
      profile,
      provider: 'openai',
      model: this.model,
    };
  }
}

export function registerVoiceRoutes(app, { commandBusService, logger } = {}) {
  const service = new WisdoVoiceService({ logger });

  async function auth(req, res, next) {
    try {
      const device = await commandBusService.authenticateDevice(
        req.headers['x-wisdo-device-id'],
        bearer(req),
      );
      if (!device) return res.status(401).json({ ok: false, error: 'Invalid device credentials.' });
      req.wisdoDevice = device;
      next();
    } catch (error) {
      next(error);
    }
  }

  app.get('/health/voice', (_req, res) => {
    res.json({
      ok: true,
      service: 'wisdo-voice-engine',
      version: '2.1.0',
      natural_provider_configured: Boolean(service.apiKey),
      default_profile: service.defaultProfile,
      profiles: service.profiles().map(({ id, display_name, description }) => ({ id, display_name, description })),
    });
  });

  app.get('/api/voice/v1/profiles', auth, (_req, res) => {
    res.json({ ok: true, profiles: service.profiles(), default_profile: service.defaultProfile });
  });

  app.post('/api/voice/v1/speech', auth, async (req, res, next) => {
    try {
      const result = await service.synthesize(req.body || {});
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Length', String(result.audio.length));
      res.setHeader('X-Wisdo-Voice-Profile', result.profile.id);
      res.setHeader('X-Wisdo-Voice-Provider', result.provider);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).send(result.audio);
    } catch (error) {
      next(error);
    }
  });

  return service;
}
