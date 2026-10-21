// Live progress target display, intentionally separate from MT4 exit execution.
// Uses verified account equity and per-account browser persistence.
export function createLiveTargetTracker(host){
 if(!host)return {setState(){},destroy(){}};
 host.innerHTML=`<section class="lm-card" style="padding:18px;border:1px solid #96722c;border-radius:17px;background:#0a1423;color:#f8e5bb;margin:12px 0">
  <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><small>WISDO LIVE CAMPAIGN TARGET</small><h2 style="margin:5px 0">Target Tracker</h2></div><strong data-target-state>NOT CONFIGURED</strong></div>
  <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:end">
   <label>Target type<select data-target-mode style="display:block;background:#14263b;color:white;padding:9px"><option value="equity">Account equity ($)</option><option value="growth">Growth from start (%)</option></select></label>
   <label>Target value<input data-target-value type="number" min="0.01" step="0.01" placeholder="e.g. 1200 or 10" style="display:block;width:155px;background:#14263b;color:white;padding:9px"></label>
   <button type="button" data-target-save>Track Target</button><button type="button" data-target-clear>Clear</button>
  </div>
  <div style="margin:12px 0;height:12px;border-radius:10px;background:#334153;overflow:hidden"><div data-target-progress style="width:0%;height:100%;background:linear-gradient(90deg,#987024,#f3d477);transition:width .3s"></div></div>
  <p data-target-detail style="margin:8px 0">Select an account to track progress.</p>
  <small>Tracking and alerts only. This does not place, modify, or close trades. Equity includes unrealized P&amp;L and can fluctuate.</small>
 </section>`;
 const mode=host.querySelector('[data-target-mode]'),value=host.querySelector('[data-target-value]');
 const progress=host.querySelector('[data-target-progress]'),stateEl=host.querySelector('[data-target-state]'),detail=host.querySelector('[data-target-detail]');
 let accountId='',equity=null,baseline=null,target=null,lastKey='';
 const storageKey=id=>'wisdo.liveTarget.v1.'+id;
 function validNumber(x){return typeof x==='number'&&Number.isFinite(x);}
 function setState(data={}){
  const nextId=String(data.accountId||'');
  if(nextId!==accountId){accountId=nextId;target=null;baseline=null;lastKey='';if(accountId){lastKey=storageKey(accountId);try{const saved=JSON.parse(localStorage.getItem(lastKey)||'null');if(saved&&['equity','growth'].includes(saved.mode)&&Number(saved.value)>0&&Number.isFinite(Number(saved.base))){target={mode:saved.mode,value:Number(saved.value)};baseline=Number(saved.base);mode.value=target.mode;value.value=String(target.value);}}catch{}}}
  equity=validNumber(data.equity)?data.equity:null;
  if(!target){stateEl.textContent='NOT CONFIGURED';progress.style.width='0%';detail.textContent=accountId?'Set a target to begin live tracking.':'Select an account to begin tracking.';return;}
  if(equity===null){stateEl.textContent='TELEMETRY UNAVAILABLE';progress.style.width='0%';detail.textContent='Awaiting verified account equity.';return;}
  const destination=target.mode==='equity'?target.value:baseline*(1+target.value/100);
  const start=baseline;
  const movement=destination-start;
  const ratio=movement>0?Math.max(0,Math.min(1,(equity-start)/movement)):equity>=destination?1:0;
  progress.style.width=(ratio*100).toFixed(2)+'%';
  stateEl.textContent=equity>=destination?'TARGET REACHED':'TRACKING';
  detail.textContent='Equity '+equity.toFixed(2)+' / Target '+destination.toFixed(2)+' · '+(ratio*100).toFixed(1)+'% progress · Start '+start.toFixed(2);
 }
 host.querySelector('[data-target-save]').onclick=()=>{
  const amount=Number(value.value);
  if(!accountId||equity===null){stateEl.textContent='ACCOUNT EQUITY REQUIRED';return;}
  if(!Number.isFinite(amount)||amount<=0){stateEl.textContent='ENTER A POSITIVE TARGET';return;}
  if(mode.value==='equity'&&amount<=equity){stateEl.textContent='TARGET MUST EXCEED EQUITY';return;}
  baseline=equity;target={mode:mode.value,value:amount};
  try{localStorage.setItem(storageKey(accountId),JSON.stringify({...target,base:baseline}));}catch{}
  setState({accountId,equity});
 };
 host.querySelector('[data-target-clear]').onclick=()=>{if(accountId)try{localStorage.removeItem(storageKey(accountId));}catch{}target=null;baseline=null;value.value='';setState({accountId,equity});};
 return {setState,destroy(){host.innerHTML='';}};
}
