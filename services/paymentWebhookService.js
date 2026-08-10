import { createHmac, timingSafeEqual } from 'node:crypto';

function safe(left,right){const a=Buffer.from(String(left||'')),b=Buffer.from(String(right||''));return a.length===b.length&&timingSafeEqual(a,b);}
export function verifyStripeSignature(rawBody,header,secret,toleranceSeconds=300,now=Date.now()){
  if(!secret||!header)return false;const fields=Object.fromEntries(String(header).split(',').map((part)=>part.split('=',2)));const timestamp=Number(fields.t);if(!Number.isFinite(timestamp)||Math.abs(now/1000-timestamp)>toleranceSeconds)return false;const expected=createHmac('sha256',secret).update(`${timestamp}.${Buffer.isBuffer(rawBody)?rawBody.toString('utf8'):String(rawBody)}`).digest('hex');return safe(fields.v1,expected);
}
export class PaymentWebhookLedger{
  constructor(events=[]){this.events=[...events];}
  apply(event,handler){const id=String(event?.id||'');if(!id)throw Object.assign(new Error('Payment event ID is required.'),{code:'payment_event_id_required'});const previous=this.events.find((row)=>row.eventId===id);if(previous)return {duplicate:true,record:previous};const outcome=handler(event);const record={eventId:id,type:String(event.type||''),status:'APPLIED',createdAt:new Date().toISOString(),outcome};this.events.push(record);return {duplicate:false,record};}
}
export function paymentAvailability(env=process.env){const configured=Boolean(env.STRIPE_SECRET_KEY&&env.STRIPE_WEBHOOK_SECRET);return configured?{available:true,provider:'stripe'}:{available:false,provider:'stripe',code:'payment_provider_unavailable',message:'Stripe checkout is unavailable until server-side credentials and webhook signing are configured.'};}
