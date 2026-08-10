export function cents(value){if(typeof value==='number'&&!Number.isInteger(value))throw Object.assign(new Error('Money must be supplied as integer cents.'),{code:'money_requires_cents'});const amount=Number(value);if(!Number.isSafeInteger(amount))throw Object.assign(new Error('Money must be a safe integer number of cents.'),{code:'invalid_money'});return amount;}
export function commissionCents(saleCents,basisPoints){return Math.floor(cents(saleCents)*Math.max(0,Number(basisPoints||0))/10_000);}

export class AffiliateLedger{
  constructor(entries=[]){this.entries=[...entries];}
  record(input={}){const key=String(input.idempotencyKey||'');if(!key)throw Object.assign(new Error('Affiliate ledger idempotency key is required.'),{code:'idempotency_required'});const existing=this.entries.find((row)=>row.idempotencyKey===key);if(existing)return existing;const row={entryId:String(input.entryId||`aff_${this.entries.length+1}`),idempotencyKey:key,affiliateId:String(input.affiliateId||''),saleId:String(input.saleId||''),type:String(input.type||'COMMISSION').toUpperCase(),amountCents:cents(input.amountCents||0),status:String(input.status||'PENDING').toUpperCase(),createdAt:input.createdAt||new Date().toISOString()};this.entries.push(row);return row;}
  balance(affiliateId){return this.entries.filter((row)=>row.affiliateId===String(affiliateId)&&['AVAILABLE','PAID'].includes(row.status)).reduce((sum,row)=>sum+row.amountCents,0);}
}
