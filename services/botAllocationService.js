import fs from 'node:fs/promises';
import path from 'node:path';

import { atomicWriteJson } from '../storage/atomicJsonFile.js';

export class BotAllocationService {
  constructor(config = {}) { this.dataDir = config.dataDir || 'data/operator-desks'; this.filePath = path.join(this.dataDir, 'bot-allocations.json'); }
  async load(){ try{return {allocations:{},...JSON.parse(await fs.readFile(this.filePath,'utf8'))};}catch{return {allocations:{}};} }
  async save(data) { await atomicWriteJson(this.filePath, data); }
  async assign({userId, accountId, bot, symbol='XAUUSD', mode='both', risk='medium'}){ const data=await this.load(); const id=`${userId}:${accountId||'default'}`; data.allocations[id]={id,userId,accountId,bot,symbol:String(symbol).toUpperCase(),mode,risk,updatedAt:new Date().toISOString()}; await this.save(data); return data.allocations[id]; }
  async status(userId){ const data=await this.load(); return Object.values(data.allocations).filter(a=>String(a.userId)===String(userId)); }
}
