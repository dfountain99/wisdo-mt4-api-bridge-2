// Seven 24-bit masks use broker server time. Day 0=Sunday.
export function normalizeWeeklyMasks(raw) {
  if(!Array.isArray(raw)||raw.length!==7)throw Object.assign(new Error('Provide seven broker-time day masks.'),{statusCode:400});
  return Array.from(raw,(value,index)=>{
    // Accept integers or explicit decimal integer strings; never coerce missing or boolean values.
    const mask=typeof value==='number'||(typeof value==='string'&&/^\d+$/.test(value))?Number(value):NaN;
    if(!Number.isSafeInteger(mask)||mask<0||mask>0xFFFFFF)throw Object.assign(new Error('Invalid 24-hour mask for day '+index),{statusCode:400});
    return mask;
  });
}
export function buildWeeklyScheduleGlobals({symbol,magicNumber,masks}={}) {
  const clean=String(symbol||'').trim(),magic=typeof magicNumber==='number'||(typeof magicNumber==='string'&&/^\d+$/.test(magicNumber))?Number(magicNumber):NaN;
  if(!/^[A-Za-z0-9._-]{3,30}$/.test(clean)||!Number.isSafeInteger(magic)||magic<=0)throw Object.assign(new Error('Exact EA symbol and magic required for scheduling.'),{statusCode:409});
  const hours=normalizeWeeklyMasks(masks),prefix='CEM.WISDO.__ACCOUNT__.'+clean+'.'+magic+'.';
  // Two-phase fail-closed update: pause new entries before writing all masks.
  // Reporter writes each Global Variable in array order. If interrupted, mode 2 remains blocked.
  return [{name:prefix+'ScheduleEnabled',value:2},
    ...hours.map((value,day)=>({name:prefix+'ScheduleDay'+day,value})),
    {name:prefix+'ScheduleEnabled',value:1}];
}
