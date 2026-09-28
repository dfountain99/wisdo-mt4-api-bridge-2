import { rankVisual, rankIndex, rankEvolution } from './rank-definitions.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function characterSvg(def,{mini=false}={}){
  const level=Number(def.level||1);
  const id=`rg${level}${mini?'m':'h'}`;
  const crown=level>=8?`
    <path d="M150 116 L176 58 L205 96 L236 36 L267 96 L296 58 L321 116 L286 102 L267 129 L236 111 L205 129 L184 102 Z" fill="none" stroke="${def.accent}" stroke-width="4" filter="url(#${id}g)"/>
    <circle cx="236" cy="58" r="8" fill="${def.accent}" filter="url(#${id}g)"/>`:'';
  const halo=level>=4?`
    <ellipse cx="236" cy="174" rx="${116+Math.min(level,9)*4}" ry="58" fill="none" stroke="${def.secondary}" stroke-width="5" opacity=".8" filter="url(#${id}g)"/>
    <ellipse cx="236" cy="174" rx="${91+Math.min(level,9)*3}" ry="42" fill="none" stroke="${def.accent}" stroke-width="2.5" opacity=".68"/>`:'';
  const scout=level>=2?`
    <path d="M105 250 L48 294 L91 311 L126 292 Z M367 250 L424 294 L381 311 L346 292 Z" fill="url(#${id}plate)" stroke="${def.primary}" stroke-width="4"/>
    <circle cx="86" cy="294" r="8" fill="${def.accent}" filter="url(#${id}g)"/><circle cx="386" cy="294" r="8" fill="${def.accent}" filter="url(#${id}g)"/>`:'';
  const tactical=level>=3?`
    <path d="M127 320 L77 348 L111 397 L154 369 Z M345 320 L395 348 L361 397 L318 369 Z" fill="#07111b" stroke="${def.secondary}" stroke-width="5"/>
    <path d="M180 342 L236 310 L292 342 L276 405 L236 439 L196 405 Z" fill="none" stroke="${def.accent}" stroke-width="3" opacity=".8"/>`:'';
  const wings=level>=4?`
    <path d="M128 292 C74 317 45 374 50 459 C84 419 112 400 154 392 L158 311 Z" fill="url(#${id}wing)" stroke="${def.secondary}" stroke-width="4" opacity=".88"/>
    <path d="M344 292 C398 317 427 374 422 459 C388 419 360 400 318 392 L314 311 Z" fill="url(#${id}wing)" stroke="${def.secondary}" stroke-width="4" opacity=".88"/>`:'';
  const monarch=level>=6?`
    <path d="M73 414 L28 458 L69 472 L99 448 Z M399 414 L444 458 L403 472 L373 448 Z" fill="${def.accent}" opacity=".34" stroke="${def.primary}" stroke-width="3"/>
    <circle cx="47" cy="460" r="10" fill="${def.primary}" opacity=".7" filter="url(#${id}g)"/><circle cx="425" cy="460" r="10" fill="${def.primary}" opacity=".7" filter="url(#${id}g)"/>`:'';
  const sovereign=level>=9?`
    <path d="M236 54 L250 13 L264 54 L286 27 L284 73 L327 51 L298 92" fill="none" stroke="${def.accent}" stroke-width="5" filter="url(#${id}g)"/>
    <path d="M236 54 L222 13 L208 54 L186 27 L188 73 L145 51 L174 92" fill="none" stroke="${def.accent}" stroke-width="5" filter="url(#${id}g)"/>
    <path d="M112 353 C59 403 43 473 58 553 C100 509 135 482 177 468" fill="none" stroke="${def.accent}" stroke-width="6" opacity=".68"/>
    <path d="M360 353 C413 403 429 473 414 553 C372 509 337 482 295 468" fill="none" stroke="${def.accent}" stroke-width="6" opacity=".68"/>`:'';

  return `<svg class="wisdo-v8-character-svg${mini?' mini':''}" viewBox="0 0 472 640" role="img" aria-label="${esc(def.title)} character ${esc(def.character)}">
    <defs>
      <linearGradient id="${id}armor" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${def.primary}"/><stop offset=".18" stop-color="#10263a"/><stop offset=".54" stop-color="#02070c"/><stop offset=".82" stop-color="${def.secondary}"/><stop offset="1" stop-color="#06111c"/></linearGradient>
      <linearGradient id="${id}plate" x1="0" x2="1"><stop stop-color="#05121e"/><stop offset=".48" stop-color="${def.secondary}"/><stop offset=".6" stop-color="#08111a"/><stop offset="1" stop-color="${def.primary}"/></linearGradient>
      <linearGradient id="${id}wing" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${def.primary}" stop-opacity=".52"/><stop offset=".55" stop-color="#02070d" stop-opacity=".92"/><stop offset="1" stop-color="${def.secondary}" stop-opacity=".38"/></linearGradient>
      <radialGradient id="${id}aura"><stop stop-color="${def.accent}" stop-opacity=".58"/><stop offset=".42" stop-color="${def.primary}" stop-opacity=".18"/><stop offset="1" stop-color="#001018" stop-opacity="0"/></radialGradient>
      <filter id="${id}g" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${mini?3:5}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <ellipse cx="236" cy="350" rx="210" ry="246" fill="url(#${id}aura)" opacity=".58"/>
    <ellipse cx="236" cy="544" rx="146" ry="33" fill="none" stroke="${def.primary}" stroke-width="3" opacity=".42"/>
    <ellipse cx="236" cy="544" rx="102" ry="22" fill="none" stroke="${def.accent}" stroke-width="2" opacity=".48"/>
    ${halo}${wings}${scout}${monarch}${sovereign}${crown}
    <path d="M236 76 L311 129 L301 212 L277 252 L257 278 L215 278 L195 252 L171 212 L161 129 Z" fill="url(#${id}armor)" stroke="${def.accent}" stroke-width="5" filter="url(#${id}g)"/>
    <path d="M182 134 L236 102 L290 134 L280 194 L255 224 L236 239 L217 224 L192 194 Z" fill="#01050a" stroke="${def.primary}" stroke-width="4"/>
    <path d="M190 157 L225 150 L214 178 L189 183 Z M282 157 L247 150 L258 178 L283 183 Z" fill="${def.accent}" filter="url(#${id}g)"/>
    <path d="M210 200 L236 217 L262 200 L252 230 L236 241 L220 230 Z" fill="${def.secondary}" opacity=".72"/>
    <path d="M145 272 L197 236 L275 236 L327 272 L352 441 L299 526 L260 507 L236 566 L212 507 L173 526 L120 441 Z" fill="url(#${id}armor)" stroke="${def.primary}" stroke-width="6"/>
    <path d="M143 282 L93 325 L112 428 L176 395 L186 295 Z M329 282 L379 325 L360 428 L296 395 L286 295 Z" fill="url(#${id}plate)" stroke="${def.secondary}" stroke-width="5"/>
    ${tactical}
    <path d="M236 267 L289 305 L272 384 L236 424 L200 384 L183 305 Z" fill="#03080e" stroke="${def.accent}" stroke-width="4"/>
    <path d="M236 289 L260 323 L248 358 L236 374 L224 358 L212 323 Z" fill="${def.primary}" opacity=".26" stroke="${def.accent}" stroke-width="3"/>
    <circle cx="236" cy="331" r="${level>=4?27:22}" fill="#03101a" stroke="${def.accent}" stroke-width="4" filter="url(#${id}g)"/>
    <circle cx="236" cy="331" r="${level>=4?12:9}" fill="${def.accent}" filter="url(#${id}g)"/>
    <path d="M177 403 L211 488 L236 540 L178 492 L145 449 Z M295 403 L261 488 L236 540 L294 492 L327 449 Z" fill="#02070c" stroke="${def.secondary}" stroke-width="3" opacity=".92"/>
    <path d="M136 348 L165 356 M336 348 L307 356 M155 409 L184 396 M317 409 L288 396" stroke="${def.accent}" stroke-width="4" opacity=".7"/>
    <g opacity=".95"><circle cx="113" cy="385" r="6" fill="${def.primary}"/><circle cx="359" cy="385" r="6" fill="${def.secondary}"/><circle cx="236" cy="566" r="7" fill="${def.accent}"/></g>
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
    <div class="wisdo-v8-aura"></div><div class="wisdo-v8-beam"></div><div class="wisdo-v8-plinth"><i></i><i></i></div><div id="wcV8Character"></div>
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
  const seenReceipts=new Set();
  let lastGreenStreak=0;

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
    q('#wcV8CharacterChamber').dataset.level=String(def.level);
    const growth=Number(record?.growthPercent||0);
    const currentMin=Number(record?.currentRank?.minGrowth||0);
    const nextMin=Number(record?.nextRank?.minGrowth||currentMin);
    const maxed=record?.nextRank?.key===record?.currentRank?.key || nextMin<=currentMin;
    const pct=maxed?100:Math.max(0,Math.min(100,((growth-currentMin)/(nextMin-currentMin))*100));
    q('#wcV8RankProgress').style.width=`${pct.toFixed(1)}%`;
    q('#wcV8RankMeta').textContent=maxed?`${growth.toFixed(1)}% account growth · highest rank`:`${growth.toFixed(1)}% growth · ${pct.toFixed(0)}% to ${rankVisual(record?.nextRank?.key).title}`;
    q('#wcV8Perks').innerHTML=def.perks.map(x=>`<b>${esc(x)}</b>`).join('');
    q('#wcV8Evolution').innerHTML=rankEvolution().map(item=>`<article class="${item.key===key?'current':''} ${rankIndex(item.key)>rankIndex(key)?'locked':''}" data-rank="${esc(item.key.toLowerCase())}">${characterSvg(item,{mini:true})}<strong>${esc(item.title)}</strong><small>${esc(item.character)} · LV.${item.level}</small></article>`).join('');
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
      const streak=Number(body.recognition?.rank?.greenStreak||0);
      if(streak>lastGreenStreak && lastGreenStreak>0){ graffiti('DISCIPLINE PAYS'); addVictory('GREEN STREAK',`${streak} equity advances`); }
      lastGreenStreak=streak;
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
    const receiptId=String(receipt?.commandId||receipt?.clientCommandId||'');
    const status=String(receipt?.status||'').toLowerCase();
    if(receiptId && seenReceipts.has(`${receiptId}:${status}`)) return;
    if(receiptId) seenReceipts.add(`${receiptId}:${status}`);
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
