import fs from 'node:fs/promises';
import path from 'node:path';

const base=String(process.env.WISDO_CLOUD_URL||'').replace(/\/$/,'');
const symbol=String(process.env.WISDO_BOOK_SYMBOL||'XAUUSD');
const target=process.env.WISDO_MT4_COMMON_FILES;
if(!base || !target) throw new Error('Set WISDO_CLOUD_URL and WISDO_MT4_COMMON_FILES.');
const interval=Math.max(200,Number(process.env.WISDO_BOOK_POLL_MS||500));

async function poll(){
  const response=await fetch(`${base}/api/market-data/order-book/${encodeURIComponent(symbol)}/mt4`,{headers:{authorization:`Bearer ${process.env.WISDO_DEVICE_TOKEN||''}`}});
  if(response.status===204) return;
  if(!response.ok) throw new Error(`Order-book request failed: ${response.status}`);
  const body=await response.text();
  const file=path.join(target,'WISDO_ORDER_BOOK.csv'),temp=`${file}.tmp`;
  await fs.mkdir(target,{recursive:true}); await fs.writeFile(temp,body,'utf8'); await fs.rename(temp,file);
}
setInterval(()=>poll().catch((error)=>console.error(error.message)),interval);
await poll();
