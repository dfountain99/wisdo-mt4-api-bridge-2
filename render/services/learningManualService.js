import { createDatabaseStateStore } from '../storage/stateStore.js';
function n(v,f=0){const x=Number(v); return Number.isFinite(x)?x:f;}
export class LearningManualService{
 constructor(_config = {}) { this.store = createDatabaseStateStore('learning_manual', () => ({ tests: [] })); }
 async load(){return this.store.read();}
  async save(data) { return this.store.write(data); }
 async logTest(input={}){const data=await this.load();const start=n(input.startingBalance);const end=n(input.endingBalance);const dd=n(input.drawdown);const gain=end-start;const rec=[]; if(dd>30) rec.push('Drawdown is too high. Lower max trades or risk before retesting.'); if(gain>0&&dd<15) rec.push('Good test. Retest same settings over another date range.'); if(String(input.notes||'').toLowerCase().includes('too many')) rec.push('Try reducing max trades and ladder count.'); if(!rec.length) rec.push('Log another test with symbol, dates, drawdown, and what you observed so WISDO can compare.'); const test={id:`test_${Date.now()}`,createdAt:new Date().toISOString(),...input,gain,recommendations:rec}; data.tests.unshift(test); data.tests=data.tests.slice(0,1000); await this.save(data); return test;}
 async summary(userId){const data=await this.load();const rows=data.tests.filter(t=>String(t.userId)===String(userId));return {count:rows.length,best:rows.sort((a,b)=>n(b.gain)-n(a.gain))[0]||null,recent:rows.slice(0,5)};}
}
