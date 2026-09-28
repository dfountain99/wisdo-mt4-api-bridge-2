// WISDO Spatial Analytics V1 — analytical overlay only; never executes orders.
const n=v=>Number.isFinite(Number(v))?Number(v):0;
const money=v=>Number.isFinite(v)?new Intl.NumberFormat(undefined,{style:'currency',currency:'USD',maximumFractionDigits:2}).format(v):'—';
const price=v=>Number.isFinite(v)&&v>0?v.toFixed(2):'—';
export function createSpatialAnalytics(host){
  const q=s=>host.querySelector(s);
  let goalPct=100;
  const render=(state,positions=[])=>{
    const panel=q('[data-spatial-analytics]'); if(!panel)return;
    const c=state?.campaignControl;
    const balance=n(state?.account?.balance ?? state?.balance ?? state?.summary?.balance);
    const equity=n(state?.account?.equity ?? state?.equity ?? state?.summary?.equity);
    const current=positions.find(p=>n(p.currentPrice)>0)?.currentPrice;
    const floating=positions.reduce((s,p)=>s+n(p.floatingMoney),0);
    const legs=positions.map(p=>{const d=n(p.currentPrice)-n(p.entryPrice);const slope=Math.abs(d)>1e-8?n(p.floatingMoney)/d:0;return {p,slope};}).filter(x=>Number.isFinite(x.slope)&&Math.abs(x.slope)>1e-8);
    const basketSlope=legs.reduce((a,x)=>a+x.slope,0);
    const weightedEntry=basketSlope?legs.reduce((sum,x)=>sum+x.slope*n(x.p.entryPrice),0)/basketSlope:0;
    const base=balance||Math.max(0,equity-floating);
    const required=base?base*goalPct/100:NaN;
    const remaining=Number.isFinite(required)?required-floating:NaN;
    const intentPrice=Number.isFinite(remaining)&&Number.isFinite(current)&&basketSlope?Number(current)+remaining/basketSlope:NaN;
    const breakEven=Number.isFinite(current)&&basketSlope?Number(current)-floating/basketSlope:weightedEntry;
    const direction=c?.direction===-1?'SELL':c?.direction===1?'BUY':'FLAT';
    const milestones=[25,50,75,100].map(pct=>{const need=base?base*(goalPct/100)*(pct/100)-floating:NaN;const p=Number.isFinite(current)&&basketSlope?Number(current)+need/basketSlope:NaN;return {pct,p};});
    panel.innerHTML=`<div class="wco-analytics-head"><div><span class="eyebrow">Spatial analytics</span><h3>Intent field</h3></div><label class="wco-goal">Goal <input data-intent-goal type="number" min="1" max="1000" step="1" value="${goalPct}">%</label></div>
      <div class="wco-intent-ladder">${milestones.reverse().map(x=>`<div class="wco-intent-plane"><b>${x.pct}%</b><span>${price(x.p)}</span><i></i></div>`).join('')}<div class="wco-intent-plane current"><b>NOW</b><span>${price(Number(current))}</span><i></i></div><div class="wco-intent-plane risk"><b>BREAK EVEN</b><span>${price(breakEven)}</span><i></i></div></div>
      <div class="wco-analytic-grid"><div><small>Campaign intent</small><strong>${goalPct}% · ${direction}</strong></div><div><small>Required profit</small><strong>${money(required)}</strong></div><div><small>Floating now</small><strong>${money(floating)}</strong></div><div><small>Remaining</small><strong>${money(remaining)}</strong></div><div><small>Intent price</small><strong>${price(intentPrice)}</strong></div><div><small>Basket break-even</small><strong>${price(breakEven)}</strong></div></div>
      <div class="wco-analysis-note">${basketSlope&&base?'Intent levels are live estimates from the currently reported basket P/L response to price. They recalculate as entries and exposure change. Dragging never changes the math.':'Waiting for enough live balance, price, and basket P/L data to calculate intent levels.'}</div>
      <div class="wco-gesture-key"><b>Spatial language</b><span>Hold = listen</span><span>Twist left = protect</span><span>Twist right = harvest</span><span>Pull up = runner</span><span>Pull sideways = isolate</span><span>Push together = basket</span><span>Pull toward WISDO = explain</span></div>`;
    q('[data-intent-goal]')?.addEventListener('change',e=>{goalPct=Math.min(1000,Math.max(1,n(e.target.value)||100));render(state,positions);});
  };
  return {render};
}
