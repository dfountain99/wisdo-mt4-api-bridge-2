import { rankVisual, rankIndex, rankEvolution } from './rank-definitions.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function characterSvg(def){
  const id='rg'+def.level;
  return `<svg class="wisdo-v8-character-svg" viewBox="0 0 420 620" role="img" aria-label="${esc(def.title)} character ${esc(def.character)}">
    <defs>
      <linearGradient id="${id}a" x1="0" x2="1"><stop stop-color="${def.primary}"/><stop offset=".52" stop-color="#07111c"/><stop offset="1" stop-color="${def.secondary}"/></linearGradient>
      <radialGradient id="${id}b"><stop stop-color="${def.accent}" stop-opacity=".95"/><stop offset=".45" stop-color="${def.primary}" stop-opacity=".35"/><stop offset="1" stop-color="#001018" stop-opacity="0"/></radialGradient>
      <filter id="${id}g"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <ellipse cx="210" cy="360" rx="190" ry="220" fill="url(#${id}b)" opacity=".42"/>
    <path d="M210 70 L288 128 L273 225 L245 255 L228 294 L192 294 L175 255 L147 225 L132 128 Z" fill="url(#${id}a)" stroke="${def.accent}" stroke-width="4" filter="url(#${id}g)"/>
    <path d="M162 150 L207 126 L258 152 L240 203 L210 225 L180 201 Z" fill="#06101a" stroke="${def.primary}" stroke-width="4"/>
    <path d="M173 166 L204 158 L195 181 L172 184 Z M247 166 L216 158 L225 181 L248 184 Z" fill="${def.accent}" filter="url(#${id}g)"/>
    <path d="M116 278 L174 236 L246 236 L304 278 L340 438 L290 522 L244 496 L210 555 L176 496 L130 522 L80 438 Z" fill="url(#${id}a)" stroke="${def.primary}" stroke-width="5"/>
    <path d="M210 254 L258 292 L235 358 L210 389 L185 358 L162 292 Z" fill="#07101a" stroke="${def.accent}" stroke-width="4"/>
    <circle cx="210" cy="337" r="34" fill="${def.primary}" opacity=".15" stroke="${def.accent}" stroke-width="4" filter="url(#${id}g)"/>
    <path d="M96 316 L50 382 L76 480 L133 450 L145 330 Z M324 316 L370 382 L344 480 L287 450 L275 330 Z" fill="#08131e" stroke="${def.secondary}" stroke-width="4"/>
    <path d="M128 112 L210 36 L292 112 L263 92 L210 67 L157 92 Z" fill="${def.level>=4?def.accent:'none'}" opacity="${def.level>=4?.55:0}" stroke="${def.level>=4?def.primary:'none'}" stroke-width="3"/>
    <g opacity=".9"><circle cx="71" cy="410" r="6" fill="${def.primary}"/><circle cx="349" cy="410" r="6" fill="${def.secondary}"/><circle cx="210" cy="566" r="7" fill="${def.accent}"/></g>
  </svg>`;
}

function markup(){
  return `<section class="wisdo-v8-rank-head">
    <span>CURRENT RANK</span><strong id="wcV8RankTitle">INITIATE</strong>
    <div><b id="wcV8CharacterName">Character · VEIL</b><em id="wcV8Level">LEVEL 1</em></div>
    <div class="wisdo-v8-rank-progress"><i id="wcV8RankProgress"></i></div>
    <small id="wcV8RankMeta">Building live rank state…</small>
  </section>
  <section class="wisdo-v8-character-chamber" id="wcV8CharacterChamber">
    <div class="wisdo-v8-aura"></div><div id="wcV8Character"></div>
    <div class="wisdo-v8-trade-chip entry" id="wcV8EntryChip">ENTRY · —</div>
    <div class="wisdo-v8-trade-chip tp" id="wcV8TpChip">TP · —</div>
    <div class="wisdo-v8-trade-chip sl" id="wcV8SlChip">PROTECT · —</div>
    <div class="wisdo-v8-graffiti left" id="wcV8GraffitiLeft"></div>
    <div class="wisdo-v8-graffiti right" id="wcV8GraffitiRight"></div>
    <div class="wisdo-v8-rain" id="wcV8Rain"></div>
    <div class="wisdo-v8-rankup" id="wcV8RankUp" hidden><span>RANK UP</span><strong></strong></div>
  </section>
  <section class="wisdo-v8-perks">
    <span>RANK PERKS</span><div id="wcV8Perks"></div>
  </section>
  <section class="wisdo-v8-evolution">
    <span>CHARACTER EVOLUTION</span><div id="wcV8Evolution"></div>
  </section>
  <section class="wisdo-v8-victories">
    <span>VICTORY STREAM</span><div id="wcV8Victories"><small>Waiting for verified wins.</small></div>
  </section>`;
}

export function createRankAscension({ overlay }={}){
  const stage=overlay?.querySelector('.wisdo-command-stage');
  if(!stage) return { refresh:async()=>{}, setCampaignState:()=>{}, onReceipt:()=>{}, stop:()=>{} };
  if(!stage.querySelector('.wisdo-v8-rank-head')) stage.insertAdjacentHTML('beforeend',markup());
  let currentKey='';
  let lastFetch=0;
  let lastAccount='';
  let state=null;
  const victories=[];

  const q=id=>stage.querySelector(id);

  function paintRank(recognition){
    const record=recognition?.rank||null;
    const key=String(record?.currentRankKey||record?.currentRank?.key||'UNRANKED').toUpperCase();
    const def=rankVisual(key);
    const previous=currentKey;
    currentKey=key;
    overlay.dataset.rank=key.toLowerCase();
    overlay.style.setProperty('--rank-primary',def.primary);
    overlay.style.setProperty('--rank-secondary',def.secondary);
    overlay.style.setProperty('--rank-accent',def.accent);
    q('#wcV8RankTitle').textContent=def.title;
    q('#wcV8CharacterName').textContent=`Character · ${def.character}`;
    q('#wcV8Level').textContent=`LEVEL ${def.level}`;
    q('#wcV8Character').innerHTML=characterSvg(def);
    const growth=Number(record?.growthPercent||0);
    const currentMin=Number(record?.currentRank?.minGrowth||0);
    const nextMin=Number(record?.nextRank?.minGrowth||currentMin);
    const maxed=record?.nextRank?.key===record?.currentRank?.key || nextMin<=currentMin;
    const pct=maxed?100:Math.max(0,Math.min(100,((growth-currentMin)/(nextMin-currentMin))*100));
    q('#wcV8RankProgress').style.width=`${pct.toFixed(1)}%`;
    q('#wcV8RankMeta').textContent=maxed?`${growth.toFixed(1)}% account growth · highest rank`:`${growth.toFixed(1)}% growth · ${pct.toFixed(0)}% to ${rankVisual(record?.nextRank?.key).title}`;
    q('#wcV8Perks').innerHTML=def.perks.map(x=>`<b>${esc(x)}</b>`).join('');
    q('#wcV8Evolution').innerHTML=rankEvolution().map(item=>`<article class="${item.key===key?'current':''} ${rankIndex(item.key)>rankIndex(key)?'locked':''}"><i style="--c:${item.primary}"></i><strong>${esc(item.title)}</strong><small>${esc(item.character)}</small></article>`).join('');
    if(previous && rankIndex(key)>rankIndex(previous)) rankUp(def);
  }

  function rankUp(def){
    const box=q('#wcV8RankUp'); box.hidden=false; box.querySelector('strong').textContent=def.title; box.classList.remove('play'); void box.offsetWidth; box.classList.add('play');
    const rain=q('#wcV8Rain'); rain.innerHTML=Array.from({length:38},(_,i)=>`<i style="--x:${(i*37)%100}%;--d:${(i%9)*.12}s;--s:${.65+(i%5)*.13}"></i>`).join('');
    rain.classList.remove('play'); void rain.offsetWidth; rain.classList.add('play');
    addVictory('RANK UP',def.title);
    setTimeout(()=>{box.hidden=true;rain.classList.remove('play');},4200);
  }

  function graffiti(text){
    const el=Math.random()>.5?q('#wcV8GraffitiLeft'):q('#wcV8GraffitiRight');
    el.textContent=text; el.classList.remove('play'); void el.offsetWidth; el.classList.add('play');
    setTimeout(()=>el.classList.remove('play'),3000);
  }

  function addVictory(label,detail=''){
    victories.unshift({label,detail,at:new Date()});
    victories.splice(6);
    q('#wcV8Victories').innerHTML=victories.map(v=>`<div><b>✦ ${esc(v.label)}</b><span>${esc(v.detail)}</span><small>${v.at.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</small></div>`).join('');
  }

  async function refresh(accountId=''){
    const now=Date.now();
    if(accountId===lastAccount && now-lastFetch<15000) return;
    lastAccount=accountId; lastFetch=now;
    try{
      const r=await fetch(`/api/presence/recognition${accountId?`?accountId=${encodeURIComponent(accountId)}`:''}`,{credentials:'same-origin',headers:{accept:'application/json'}});
      if(!r.ok) throw new Error('rank '+r.status);
      const body=await r.json();
      paintRank(body.recognition||null);
      const pending=body.recognition?.selected?.pendingMilestone;
      if(pending && Number(pending.milestonePercent)>0){
        const key=`milestone:${pending.accountId}:${pending.milestonePercent}`;
        if(sessionStorage.getItem(key)!=='1'){
          sessionStorage.setItem(key,'1');
          graffiti(`${pending.milestonePercent}% MILESTONE`);
          addVictory('GROWTH MILESTONE',`${pending.milestonePercent}%`);
        }
      }
    }catch{
      paintRank(null);
      q('#wcV8RankMeta').textContent='Rank service unavailable · showing Initiate form';
    }
  }

  function setCampaignState(next,campaign){
    state=next;
    const c=campaign||next?.campaigns?.[0]||null;
    const chamber=q('#wcV8CharacterChamber');
    chamber.dataset.mood=!c?'idle':next?.campaignControl?.paused?'protecting':c?.positionCount>0?'trading':'armed';
    q('#wcV8EntryChip').textContent=`ENTRY · ${c?.averageEntry??'—'}`;
    q('#wcV8TpChip').textContent=`TP · ${c?.takeProfit??'—'}`;
    q('#wcV8SlChip').textContent=`PROTECT · ${c?.stopLoss??'—'}`;
  }

  function onReceipt(receipt){
    const status=String(receipt?.status||'').toLowerCase();
    if(status!=='completed') return;
    const command=String(receipt?.command||'').toUpperCase();
    if(command.includes('CLOSE') || command.includes('PROFIT')){
      const pnl=Number(state?.financial?.floatingPL||0);
      if(pnl>=0){ graffiti(pnl>0?'ANOTHER WIN':'COLLECTED'); addVictory('COLLECTED',pnl?new Intl.NumberFormat(undefined,{style:'currency',currency:state?.financial?.currency||'USD'}).format(pnl):'EA confirmed'); }
    }
    if(command.includes('LOCK')||command.includes('PROTECT')) graffiti('PROTECTED');
  }

  paintRank(null);
  return {refresh,setCampaignState,onReceipt,triggerVictory:(t,d)=>{graffiti(t);addVictory(t,d);},stop(){}};
}
