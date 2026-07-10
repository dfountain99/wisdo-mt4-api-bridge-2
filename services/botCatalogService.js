import path from 'node:path';
import { access, copyFile, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';

import { logger } from '../logger.js';
import { cleanBotName, inferBotProfile, slugify } from '../utils/store.js';

const BOT_EXTENSION = '.ex4';
const EXCLUDED_NAME_PATTERNS = [
  /^macd sample/i,
  /^moving average/i,
  /^culturecoin_mt4_reporter/i,
  /reporter/i,
  /^periodconverter/i,
  /trade panel/i,
  /^fxdreema/i,
];

async function pathExists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function walkDirectory(rootPath) {
  const discovered = [];
  const stack = [rootPath];

  while (stack.length) {
    const current = stack.pop();
    const entries = await readdir(current, { withFileTypes: true }).catch(() => []);

    for (const entry of entries) {
      const nextPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(nextPath);
        continue;
      }

      discovered.push(nextPath);
    }
  }

  return discovered;
}

function pickPreferredSource(existingSource, nextSource) {
  if (!existingSource) {
    return nextSource;
  }

  if ((nextSource.size || 0) > (existingSource.size || 0)) {
    return nextSource;
  }

  return new Date(nextSource.modifiedAt) > new Date(existingSource.modifiedAt) ? nextSource : existingSource;
}

export class BotCatalogService {
  constructor(config, repository) {
    this.config = config;
    this.repository = repository;
  }

  getDeliveryDir() {
    return this.config.store.deliveryDir;
  }

  getInstallGuidePath() {
    return path.join(this.getDeliveryDir(), 'CULTURE_COIN_BOT_INSTALL.txt');
  }

  async ensureInstallGuide() {
    await mkdir(this.getDeliveryDir(), { recursive: true });
    const guidePath = this.getInstallGuidePath();

    if (await pathExists(guidePath)) {
      return guidePath;
    }

    await writeFile(
      guidePath,
      [
        'Culture Coin MT4 Bot Install Guide',
        '',
        '1. Download the .ex4 file from your private Discord delivery message.',
        '2. In MT4, open File -> Open Data Folder -> MQL4 -> Experts.',
        '3. Drop the .ex4 file into the Experts folder.',
        '4. Restart MT4 or refresh Navigator.',
        '5. Attach the bot to the chart you want to operate on.',
        '6. Load any preset or operating rules Coach provided separately.',
        '',
        'Important:',
        '- These files are for the licensed user only.',
        '- Do not reshare, repost, or redistribute them.',
        '- If you are a Culture Coin member, ask Coach for the matching operating rules and desk workflow.',
      ].join('\n'),
      'utf8',
    );

    return guidePath;
  }

  async discoverExpertDirectories() {
    const configured = this.config.store.sourceDirs.filter(Boolean);
    if (configured.length > 0) {
      return configured;
    }

    const directories = [];
    const appDataRoot = path.join(process.env.APPDATA || '', 'MetaQuotes', 'Terminal');
    if (await pathExists(appDataRoot)) {
      const terminals = await readdir(appDataRoot, { withFileTypes: true }).catch(() => []);
      for (const terminal of terminals) {
        if (!terminal.isDirectory()) {
          continue;
        }

        const expertDir = path.join(appDataRoot, terminal.name, 'MQL4', 'Experts');
        if (await pathExists(expertDir)) {
          directories.push(expertDir);
        }
      }
    }

    const knownInstallDirs = [
      'C:\\KOT MT4 Terminal\\MQL4\\Experts',
      'C:\\Program Files (x86)\\KOT MT4 Terminal\\MQL4\\Experts',
    ];

    for (const directory of knownInstallDirs) {
      if (await pathExists(directory)) {
        directories.push(directory);
      }
    }

    return [...new Set(directories)];
  }

  isSellableBotFile(filePath) {
    const fileName = path.basename(filePath);
    if (!fileName.toLowerCase().endsWith(BOT_EXTENSION)) {
      return false;
    }

    return !EXCLUDED_NAME_PATTERNS.some((pattern) => pattern.test(fileName));
  }

  async discoverLocalBots() {
    const expertDirectories = await this.discoverExpertDirectories();
    const deduped = new Map();

    for (const directory of expertDirectories) {
      const files = await walkDirectory(directory);
      for (const filePath of files) {
        if (!this.isSellableBotFile(filePath)) {
          continue;
        }

        const fileStat = await stat(filePath).catch(() => null);
        if (!fileStat?.isFile()) {
          continue;
        }

        const name = cleanBotName(path.basename(filePath));
        const key = slugify(name);
        const source = {
          name,
          key,
          fullPath: filePath,
          originalFileName: path.basename(filePath),
          size: fileStat.size,
          modifiedAt: fileStat.mtime.toISOString(),
          directory: path.dirname(filePath),
        };

        deduped.set(key, pickPreferredSource(deduped.get(key), source));
      }
    }

    return [...deduped.values()].sort((left, right) => left.name.localeCompare(right.name));
  }

  buildBotRecord(source, existingBot = null) {
    const profile = inferBotProfile(source.name);
    const slug = existingBot?.slug || source.key;

    return {
      id: existingBot?.id || slug,
      slug,
      name: existingBot?.name || source.name,
      platform: 'mt4',
      style: existingBot?.style || profile.style,
      audience: existingBot?.audience || profile.audience,
      summary: existingBot?.summary || profile.summary,
      description:
        existingBot?.description ||
        `${profile.summary} Best fit for ${profile.audience}. This description is catalog-based and does not expose the source code.`,
      basePriceUsd: existingBot?.basePriceUsd ?? this.config.store.basePriceUsd,
      cultureCoinPriceUsd:
        existingBot?.cultureCoinPriceUsd ?? this.config.store.cultureCoinPriceUsd,
      freeClaimEligible: existingBot?.freeClaimEligible ?? true,
      bundleEligible: existingBot?.bundleEligible ?? true,
      active: existingBot?.active ?? true,
      deliveryFileName: source.originalFileName,
      deliveryPath: path.join(this.getDeliveryDir(), source.originalFileName),
      sourcePath: source.fullPath,
      sourceModifiedAt: source.modifiedAt,
      sourceSize: source.size,
      updatedAt: new Date().toISOString(),
      createdAt: existingBot?.createdAt || new Date().toISOString(),
    };
  }

  async syncLocalInventory() {
    await mkdir(this.getDeliveryDir(), { recursive: true });
    await this.ensureInstallGuide();

    const [existingBots, discoveredBots] = await Promise.all([
      this.repository.getAllBots(),
      this.discoverLocalBots(),
    ]);

    const existingBySlug = new Map(existingBots.map((bot) => [bot.slug, bot]));
    const syncedBots = [];

    for (const source of discoveredBots) {
      const existingBot = existingBySlug.get(source.key) || null;
      const botRecord = this.buildBotRecord(source, existingBot);

      await copyFile(source.fullPath, botRecord.deliveryPath);
      syncedBots.push(botRecord);
    }

    if (syncedBots.length > 0) {
      await this.repository.saveBots(syncedBots);
    }

    logger.info('Bot catalog sync complete', {
      discovered: discoveredBots.length,
      synced: syncedBots.length,
      deliveryDir: this.getDeliveryDir(),
    });

    return {
      discovered: discoveredBots.length,
      synced: syncedBots.length,
      bots: syncedBots,
      deliveryDir: this.getDeliveryDir(),
    };
  }

  async getCatalog({ activeOnly = true } = {}) {
    const bots = await this.repository.getAllBots();
    return bots
      .filter((bot) => (activeOnly ? bot.active !== false : true))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async resolveBotInput(input) {
    const bots = await this.getCatalog({ activeOnly: false });
    const normalizedInput = slugify(cleanBotName(input));
    if (!normalizedInput) {
      return { bot: null, matches: [] };
    }

    const exact =
      bots.find(
        (bot) =>
          bot.id === normalizedInput ||
          bot.slug === normalizedInput ||
          slugify(bot.name) === normalizedInput,
      ) || null;

    if (exact) {
      return { bot: exact, matches: [exact] };
    }

    const matches = bots.filter((bot) => {
      const searchable = `${bot.name} ${bot.slug}`.toLowerCase();
      return searchable.includes(normalizedInput.replace(/-/g, ' ')) || searchable.includes(normalizedInput);
    });

    return {
      bot: matches.length === 1 ? matches[0] : null,
      matches,
    };
  }
}
