import fs from 'node:fs/promises';
import path from 'node:path';

import { atomicWriteJson } from '../storage/atomicJsonFile.js';
function n(v,f=0){const x=Number(v); return Number.isFinite(x)?x:f;}
export class LearningManualService{
 constructor(config={}){this.dataDir=config.dataDir||'data/operator-desks';this.filePath=path.join(this.dataDir,'learning-manual.json');}
 async load(){try{return {tests:[],...JSON.parse(await fs.readFile(this.filePath,'utf8'))};}catch{return {tests:[]};}}
  async save(data) { await atomicWriteJson(this.filePath, data); }
 async logTest(input={}){const data=await this.load();const start=n(input.startingBalance);const end=n(input.endingBalance);const dd=n(input.drawdown);const gain=end-start;const rec=[]; if(dd>30) rec.push('Drawdown is too high. Lower max trades or risk before retesting.'); if(gain>0&&dd<15) rec.push('Good test. Retest same settings over another date range.'); if(String(input.notes||'').toLowerCase().includes('too many')) rec.push('Try reducing max trades and ladder count.'); if(!rec.length) rec.push('Log another test with symbol, dates, drawdown, and what you observed so WISDO can compare.'); const test={id:`test_${Date.now()}`,createdAt:new Date().toISOString(),...input,gain,recommendations:rec}; data.tests.unshift(test); data.tests=data.tests.slice(0,1000); await this.save(data); return test;}
 async summary(userId){const data=await this.load();const rows=data.tests.filter(t=>String(t.userId)===String(userId));return {count:rows.length,best:rows.sort((a,b)=>n(b.gain)-n(a.gain))[0]||null,recent:rows.slice(0,5)};}
}
