import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { Mt4SyncService } from '../services/mt4SyncService.js';

const reporterCounts=(process.argv[2]||'1,10,50,100').split(',').map(Number).filter((n)=>n>0&&n<=100);
const rounds=Math.max(2,Math.min(50,Number(process.argv[3]||10)));
const output=console.log.bind(console);console.log=()=>{};
process.env.WISDO_MT4_SYNC_MIN_INTERVAL_MS='1';process.env.WISDO_REPLAY_EXISTING_TRADES_ON_FIRST_SYNC='false';
const percentile=(rows,p)=>rows[Math.min(rows.length-1,Math.floor(rows.length*p))]||0;
const reports=[];
for(const reporterCount of reporterCounts){
  const state=new Map(),pairings=new Map();for(let i=0;i<reporterCount;i++){const pairingCode=`CEM-P${String(i).padStart(7,'0')}`;pairings.set(pairingCode,{pairingCode,discordUserId:`user-${i}`,status:'connected',accountNumber:String(700000+i),brokerServer:'Pressure-Demo',createdAt:'2026-08-09T00:00:00Z',connectedAt:'2026-08-09T00:00:00Z',expiresAt:'2030-08-09T00:00:00Z'});}
  let dbWriteMs=0,writes=0;const repository={async getPairingCode(code){return pairings.get(code)||null;},getMt4AccountId(number,server){return `${number}:${server}`;},async getMt4SnapshotContext(id){return state.get(id)||{connection:null,settings:{},latestSnapshot:null,tracking:null,activeAccountId:null};},async persistMt4Snapshot(payload){const started=performance.now();state.set(payload.connectionRecord.accountId,{connection:payload.connectionRecord,settings:payload.settings,latestSnapshot:payload.latestSnapshotRecord,tracking:payload.tracking,activeAccountId:payload.connectionRecord.accountId});dbWriteMs+=performance.now()-started;writes++;}};
  const service=new Mt4SyncService({api:{mt4SyncApiKey:''},wisdo:{mt4StaleMinutes:5}},repository);const timings=[];const loop=monitorEventLoopDelay({resolution:10});loop.enable();
  for(let round=0;round<rounds;round++){await Promise.all([...pairings.values()].map(async(pairing,index)=>{service.requestTimestamps.clear();const started=performance.now();await service.receiveSnapshot({pairingCode:pairing.pairingCode,accountNumber:pairing.accountNumber,brokerServer:pairing.brokerServer,balance:10000+round,equity:10005+round,margin:100,freeMargin:9905,marginLevel:10000,floatingPL:5,dailyClosedPL:0,openTradeCount:1,buyTradeCount:1,sellTradeCount:0,totalLots:0.01,terminalConnected:true,expertEnabled:true,reporterVersion:'1.59',terminalVersion:'MT4',timestamp:new Date(1786280000000+round*15000+index).toISOString(),openTrades:[{ticket:`${index+1}`,symbol:'XAUUSD',type:'buy',lots:0.01,openPrice:2000,currentPrice:2001,profit:1,openTime:'2026-08-09T00:00:00Z'}]});timings.push(performance.now()-started);}));}
  loop.disable();timings.sort((a,b)=>a-b);const memory=process.memoryUsage();reports.push({reporters:reporterCount,samples:timings.length,p50Ms:Number(percentile(timings,.50).toFixed(3)),p95Ms:Number(percentile(timings,.95).toFixed(3)),p99Ms:Number(percentile(timings,.99).toFixed(3)),averageDbWriteMs:Number((dbWriteMs/Math.max(1,writes)).toFixed(3)),eventLoopLagP99Ms:Number((loop.percentile(99)/1e6).toFixed(3)),heapUsedMb:Number((memory.heapUsed/1048576).toFixed(2)),rssMb:Number((memory.rss/1048576).toFixed(2))});
}
output(JSON.stringify({ok:true,rounds,reports},null,2));
