import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export class WisdoSpeechService {
  constructor(config) {
    this.enabled = String(process.env.WISDO_SPEECH_ENABLED || 'false').toLowerCase() === 'true';
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.model = process.env.WISDO_SPEECH_MODEL || 'gpt-4o-mini-tts';
    this.voice = process.env.WISDO_SPEECH_VOICE || 'cedar';
    this.outputDir = path.join(config.dataDir || 'data/operator-desks', 'wisdo-audio');
  }

  isReady() {
    return this.enabled && Boolean(this.apiKey);
  }

  cleanTextForSpeech(text) {
    return String(text || '')
      .replace(/[`*_>#|]/g, '')
      .replace(/<@!?\d+>/g, '')
      .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, 1200);
  }

  async createSpeechFile(text, label = 'wisdo') {
    if (!this.isReady()) {
      return null;
    }

    const cleanText = this.cleanTextForSpeech(text);

    if (!cleanText) {
      return null;
    }

    await fs.mkdir(this.outputDir, { recursive: true });

    const fileName = `${label}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.mp3`;
    const filePath = path.join(this.outputDir, fileName);

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        voice: this.voice,
        input: cleanText,
        instructions: 'Speak like a calm trading coach. Be clear, confident, brief, and helpful.',
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`WISDO speech failed: HTTP ${response.status} ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(arrayBuffer));

    return {
      filePath,
      fileName,
      spokenText: cleanText,
    };
  }
}