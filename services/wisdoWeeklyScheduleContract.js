// Exact double integers preserve all 48 half-hour slots, Monday=0.
export const MAX_WEEKLY_MASK=281474976710655;
export function validateWeeklyMasks(value){
 if(!Array.isArray(value)||value.length!==7||!value.every(n=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0&&n<=MAX_WEEKLY_MASK))
 throw Object.assign(new Error('Specify seven exact 48-slot masks, Monday through Sunday.'),{statusCode:400,code:'invalid_weekly_schedule'});
 return value.slice();
}
export function weeklyScheduleGlobals({symbol,magic,masks,enabled}){
 if(!/^[A-Za-z0-9_.-]{1,20}$/.test(String(symbol||'')))throw Object.assign(new Error('Exact broker symbol must contain 1–20 safe characters.'),{statusCode:400});
 if(!Number.isSafeInteger(Number(magic))||Number(magic)<1||Number(magic)>2147483647)throw Object.assign(new Error('Verified positive MagicNumber required.'),{statusCode:400});
 const days=validateWeeklyMasks(masks),prefix='CEM.WS.__ACCOUNT__.'+Number(magic)+'.'+symbol+'.';
 // Two-phase atomicity: EN=2 blocks entries while all seven masks are replaced.
 return [{name:prefix+'EN',value:2},...days.map((value,day)=>({name:prefix+'D'+day,value})),{name:prefix+'EN',value:enabled===true?1:0}];
}
