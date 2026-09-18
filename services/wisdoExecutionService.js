import { randomUUID } from 'node:crypto';

export class WisdoExecutionService {
  constructor({ pool, mt4CommandService, copyTradingService = null, safetyService=null, auditService=null, getAuthorizedAccounts=async()=>[] } = {}) { Object.assign(this,{pool,mt4CommandService,copyTradingService,safetyService,auditService,getAuthorizedAccounts}); }

  async queue({ userId, deviceId=null, accountId, intent, commandName, parameters={}, rawText='', safetyLevel='CONTROLLED', planId=null, confirmationStatus='CONFIRMED' }) {
    if (!accountId) throw Object.assign(new Error('An account must be selected before a trading command can be queued.'),{code:'account_required'});
    try{const accounts=await this.getAuthorizedAccounts(userId);const selected=accounts.filter((account)=>String(account.accountId||account.account_id||account.id)===String(accountId));this.safetyService?.assertAccountAccess([accountId],accounts);this.safetyService?.assertVoiceExecutionMode(selected);}catch(error){await this.auditService?.record({userId,actorType:'safety',eventType:'voice.execution_blocked',correlationId:planId||null,detail:{code:error.code||'execution_blocked',accountIds:[String(accountId)],intent}}).catch(()=>undefined);throw error;}
    const idempotencyKey=parameters.idempotencyKey||`${userId}:${accountId}:${intent}:${planId||rawText}`;
    const payload={...parameters,deviceId,planId,rawText,safetyLevel,confirmation:confirmationStatus==='CONFIRMED'?'confirmed':undefined,idempotencyKey,dedupeKey:idempotencyKey};
    const command=await this.mt4CommandService.queueCommandForAccount(userId,accountId,commandName,payload);
    await this.receipt({commandId:command.id,userId,accountId,planId,status:'PENDING',result:{intent,parameters,queuedAt:command.createdAt}});
    return command;
  }

  async receipt({commandId,userId,accountId=null,planId=null,status,result={},failureReason=null}) {
    const lifecycle=String(status||'').toUpperCase();
    const r=await this.pool.query(`INSERT INTO wisdo_command_receipts(receipt_id,command_id,owner_user_id,account_id,plan_id,lifecycle_status,result,failure_reason) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8) RETURNING *`,[randomUUID(),commandId,userId,accountId,planId,lifecycle,JSON.stringify(result||{}),failureReason]);return r.rows[0];
  }

  verification(command,receipts=[]) {
    if(String(command?.status||'').toLowerCase()!=='completed')return {verified:false,reason:'command_not_completed'};
    const targets=(command?.payload?.targetTickets||command?.targetTickets||[]).map(String);if(!targets.length)return {verified:true,reason:'reporter_completed'};
    const receipt=[...receipts].reverse().find((row)=>String(row.lifecycle_status||'').toUpperCase()==='COMPLETED'),result=receipt?.result||command?.result||{};const rawClosed=result.closedTickets||result.closedTicketIds||result.ticketsClosed||[];const closed=(Array.isArray(rawClosed)?rawClosed:[]).map((ticket)=>String(ticket?.ticket??ticket?.id??ticket));const remaining=(Array.isArray(result.remainingTickets)?result.remainingTickets:[]).map(String);const missing=targets.filter((ticket)=>!closed.includes(ticket));const closedCount=Number(result.closedCount??closed.length);const exact=(missing.length===0||closedCount>=targets.length)&&remaining.length===0;
    return {verified:exact,reason:exact?'all_target_tickets_closed':'target_ticket_evidence_incomplete',targetTickets:targets,closedTickets:closed,missingTickets:missing,remainingTickets:remaining};
  }

  async status(userId,commandId){const command=await this.mt4CommandService.getCommandStatus(userId,commandId);const r=await this.pool.query(`SELECT * FROM wisdo_command_receipts WHERE owner_user_id=$1 AND command_id=$2 ORDER BY received_at`,[userId,commandId]);const verification=this.verification(command,r.rows);return {command,receipts:r.rows,verified:verification.verified,verification};}
  responseFor(command){const status=String(command?.status||'pending').toLowerCase();if(status==='completed')return `Completed. ${command.result?.message||'MT4 verified the command.'} What else can I help you with today?`;if(status==='failed')return `The command failed. ${command.errorMessage||command.result?.message||'The trading service did not complete it.'}`;if(status==='delivered')return 'The command was delivered to MT4 and is awaiting a verified completion receipt.';return `Confirmed. The ${String(command?.command||'command').toLowerCase().replaceAll('_',' ')} command has been queued.`;}
}
