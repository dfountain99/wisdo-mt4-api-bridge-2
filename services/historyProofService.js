import fs from 'node:fs/promises';
import path from 'node:path';

import { atomicWriteJson } from '../storage/atomicJsonFile.js';
function n(v,f=0){const x=Number(v); return Number.isFinite(x)?x:f;}
function money(v){return `$${n(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;}
export class HistoryProofService{
 constructor(config={}){this.dataDir=config.dataDir||'data/operator-desks';this.filePath=path.join(this.dataDir,'history-proof.json');}
 async load(){try{return {snapshots:[],reports:[],...JSON.parse(await fs.readFile(this.filePath,'utf8'))};}catch{return {snapshots:[],reports:[]};}}
  async save(data) { await atomicWriteJson(this.filePath, data); }
 async recordSnapshot({userId,accountId,snapshot={}}){const data=await this.load();data.snapshots.unshift({id:`snap_${Date.now()}`,userId,accountId,snapshot,createdAt:new Date().toISOString()});data.snapshots=data.snapshots.slice(0,5000);await this.save(data);return data.snapshots[0];}
 async buildReport({userId,accountId=null,period='today'}={}){const data=await this.load();const rows=data.snapshots.filter(r=>String(r.userId)===String(userId)&&(!accountId||r.accountId===accountId));const latest=rows[0]?.snapshot||{};const earliest=rows[rows.length-1]?.snapshot||latest;const start=n(earliest.balance||earliest.equity,0);const end=n(latest.equity||latest.balance,0);const gain=end-start;const pct=start?gain/start*100:0;return {ok:true,period,count:rows.length,card:[`DF / WISDO ${period} Proof Report`,`Starting: ${money(start)}`,`Ending equity: ${money(end)}`,`Net change: ${money(gain)} (${pct.toFixed(2)}%)`,`Open trades: ${latest.openTradeCount??0}`,`Bot: ${latest.eaName||'unknown'}`].join('\n')};}
}
