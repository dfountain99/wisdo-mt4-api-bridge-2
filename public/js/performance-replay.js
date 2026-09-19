(() => {
  const root=document.querySelector('[data-wisdo-performance-replay]'); if(!root) return;
  let payload={days:[]}; try{payload=JSON.parse(root.querySelector('[data-replay-payload]')?.textContent||'{"days":[]}')}catch{}
  const days=Array.isArray(payload.days)?payload.days:[]; const byDate=new Map(days.map(d=>[d.date,d]));
  let selected=payload.selectedDate||days.at(-1)?.date||new Date().toISOString().slice(0,10);
  let cursor=new Date((selected||new Date().toISOString().slice(0,10))+'T12:00:00');
  const money=n=>{n=Number(n||0);return (n<0?'-$':'+$')+Math.abs(n).toLocaleString('en-US',{maximumFractionDigits:2})};
  const time=v=>{const d=new Date(v);return Number.isFinite(d.getTime())?d:null};
  function dayTrades(d){return Array.isArray(d?.trades)?d.trades:[]}
  function summary(d){const t=dayTrades(d), pnl=t.reduce((s,x)=>s+Number(x.pnl||0),0), wins=t.filter(x=>Number(x.pnl||0)>0).length, loss=t.filter(x=>Number(x.pnl||0)<0).length;return{pnl,count:t.length,wins,loss,winRate:t.length?Math.round(wins/t.length*100):0,lots:t.reduce((s,x)=>s+Number(x.lots||0),0)}}
  function drawChart(d){
    const el=root.querySelector('[data-market-path]'), t=dayTrades(d); if(!t.length){el.innerHTML='<div class="replay-empty"><div><strong>No trade path stored for this day.</strong><br>Reporter history will populate entries and closes automatically.</div></div>';return}
    const pts=[]; t.forEach(x=>{const a=time(x.openTime),b=time(x.closeTime); if(a&&Number.isFinite(Number(x.openPrice)))pts.push({t:a.getTime(),p:Number(x.openPrice)});if(b&&Number.isFinite(Number(x.closePrice)))pts.push({t:b.getTime(),p:Number(x.closePrice)})}); pts.sort((a,b)=>a.t-b.t);
    if(!pts.length){el.innerHTML='<div class="replay-empty">Trade records exist, but entry/close prices are not available yet.</div>';return}
    const minT=Math.min(...pts.map(x=>x.t)),maxT=Math.max(...pts.map(x=>x.t)),minP=Math.min(...pts.map(x=>x.p)),maxP=Math.max(...pts.map(x=>x.p)),dx=Math.max(1,maxT-minT),dp=Math.max(.0001,maxP-minP);
    const xy=(tt,pp)=>[40+(tt-minT)/dx*920,285-(pp-minP)/dp*245];
    const path=pts.map((q,i)=>{const [x,y]=xy(q.t,q.p);return (i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)}).join(' ');
    let trades='';t.forEach(x=>{const a=time(x.openTime),b=time(x.closeTime),op=Number(x.openPrice),cp=Number(x.closePrice);if(!a||!b||!Number.isFinite(op)||!Number.isFinite(cp))return;const [x1,y1]=xy(a.getTime(),op),[x2,y2]=xy(b.getTime(),cp),side=String(x.type||'').toLowerCase().includes('sell')?'sell':'buy';trades+='<line class="replay-trade-line '+side+'" x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'"/><circle class="replay-entry '+side+'" cx="'+x1+'" cy="'+y1+'" r="5"/><circle class="replay-exit" cx="'+x2+'" cy="'+y2+'" r="5"/>'});
    const grid=[1,2,3,4].map(i=>'<line class="replay-grid-line" x1="0" y1="'+i*60+'" x2="1000" y2="'+i*60+'"/>').join('');
    el.innerHTML='<svg viewBox="0 0 1000 320" preserveAspectRatio="none">'+grid+'<path class="replay-path" d="'+path+'"/>'+trades+'</svg>';
  }
  function heat(d){
    const t=dayTrades(d), bins=Array.from({length:24},()=>({buy:0,sell:0,close:0,pnl:0}));
    t.forEach(x=>{const o=time(x.openTime),c=time(x.closeTime),side=String(x.type||'').toLowerCase();if(o){const h=o.getHours();bins[h][side.includes('sell')?'sell':'buy']++}if(c){const h=c.getHours();bins[h].close++;bins[h].pnl+=Number(x.pnl||0)}});
    const max=k=>Math.max(1,...bins.map(x=>x[k]||0)); const cell=(v,m,cls='')=>'<span class="flow-cell '+cls+'" data-level="'+(v?Math.max(1,Math.ceil(v/m*4)):'')+'"></span>';
    const rows=[['BUY HEAT','buy',''],['SELL HEAT','sell','sell'],['CLOSE','close','close']];
    let html=rows.map(([label,k,cl])=>'<div class="flow-row '+cl+'"><strong>'+label+'</strong><div class="flow-cells">'+bins.map(x=>cell(x[k],max(k))).join('')+'</div></div>').join('');
    html+='<div class="flow-row pnl"><strong>P&L FLOW</strong><div class="flow-cells">'+bins.map(x=>'<span class="flow-cell '+(x.pnl>0?'positive':x.pnl<0?'negative':'')+'"></span>').join('')+'</div></div>';
    root.querySelector('[data-flow-heat]').innerHTML=html;
  }
  function renderDay(){
    const d=byDate.get(selected)||{date:selected,trades:[]}; const s=summary(d), title=new Date(selected+'T12:00:00').toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'});
    root.querySelector('[data-selected-date]').textContent=title; const p=root.querySelector('[data-selected-pnl]');p.textContent=s.count?money(s.pnl):'$0.00';p.className='replay-pnl '+(s.pnl<0?'negative':'positive');
    const vals={trades:s.count,winrate:s.winRate+'%',lots:s.lots.toFixed(2),wins:s.wins,losses:s.loss,net:s.count?money(s.pnl):'$0.00'};Object.entries(vals).forEach(([k,v])=>{const e=root.querySelector('[data-stat="'+k+'"]');if(e)e.textContent=v});
    drawChart(d);heat(d);renderCalendar();
  }
  function renderCalendar(){
    const y=cursor.getFullYear(),m=cursor.getMonth(),first=new Date(y,m,1),last=new Date(y,m+1,0),grid=root.querySelector('[data-calendar-grid]');root.querySelector('[data-calendar-title]').textContent=first.toLocaleDateString(undefined,{month:'long',year:'numeric'});
    let h=['SUN','MON','TUE','WED','THU','FRI','SAT'].map(x=>'<div class="pnl-dow">'+x+'</div>').join(''); for(let i=0;i<first.getDay();i++)h+='<div></div>';
    for(let n=1;n<=last.getDate();n++){const key=y+'-'+String(m+1).padStart(2,'0')+'-'+String(n).padStart(2,'0'),d=byDate.get(key),s=summary(d),cls=d?(s.pnl<0?'loss':'profit'):'empty';h+='<button class="pnl-day '+cls+(key===selected?' selected':'')+'" data-day="'+key+'" '+(!d?'disabled':'')+'><span class="date">'+n+'</span>'+(d?'<span class="amount">'+money(s.pnl)+'</span><small>'+s.count+' trades</small>':'')+'</button>'}
    grid.innerHTML=h;grid.querySelectorAll('[data-day]:not([disabled])').forEach(b=>b.onclick=()=>{selected=b.dataset.day;cursor=new Date(selected+'T12:00:00');renderDay()});
  }
  root.querySelector('[data-cal-prev]').onclick=()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()-1,1);renderCalendar()};
  root.querySelector('[data-cal-next]').onclick=()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);renderCalendar()};
  renderDay();
})();