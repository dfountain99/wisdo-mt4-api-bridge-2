import { createDatabaseStateStore } from '../storage/stateStore.js';

export class BotAllocationService {
  constructor(_config = {}) { this.store = createDatabaseStateStore('bot_allocations', () => ({ allocations: {} })); }
  async load(){ return this.store.read(); }
  async save(data) { return this.store.write(data); }
  async assign({userId, accountId, bot, symbol='XAUUSD', mode='both', risk='medium'}){ const data=await this.load(); const id=`${userId}:${accountId||'default'}`; data.allocations[id]={id,userId,accountId,bot,symbol:String(symbol).toUpperCase(),mode,risk,updatedAt:new Date().toISOString()}; await this.save(data); return data.allocations[id]; }
  async status(userId){ const data=await this.load(); return Object.values(data.allocations).filter(a=>String(a.userId)===String(userId)); }
}
