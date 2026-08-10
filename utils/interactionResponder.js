import { randomUUID } from 'node:crypto';

function editPayload(payload) { if(typeof payload!=='object'||!payload)return payload;const next={...payload};delete next.ephemeral;if(next.flags===64)delete next.flags;return next; }

export class InteractionResponder {
  constructor(interaction,{logger=console,commandName=null,accountId=null,clock=()=>Date.now()}={}){this.interaction=interaction;this.logger=logger;this.clock=clock;this.startedAt=clock();this.primary=false;this.record={interactionId:String(interaction?.id||randomUUID()),command:commandName||interaction?.commandName||'',userId:String(interaction?.user?.id||''),guildId:String(interaction?.guildId||''),accountId,startedAt:new Date(this.startedAt).toISOString(),ackAt:null,completedAt:null,result:null,errorCode:null};}
  acknowledged(){return Boolean(this.interaction?.deferred||this.interaction?.replied||this.primary);}
  markAck(){this.record.ackAt||=new Date(this.clock()).toISOString();}
  async defer(options={flags:64}){if(this.acknowledged())return null;const value=await this.interaction.deferReply(options);this.markAck();return value;}
  async reply(payload){let value;if(this.interaction.deferred&&!this.primary)value=await this.interaction.editReply(editPayload(payload));else if(this.interaction.replied||this.primary)value=await this.interaction.followUp(payload);else value=await this.interaction.reply(payload);this.primary=true;this.markAck();return value;}
  async edit(payload){const value=await this.interaction.editReply(editPayload(payload));this.primary=true;this.markAck();return value;}
  async followUp(payload){return this.interaction.followUp(payload);}
  async deferUpdate(){if(this.acknowledged())return null;const value=await this.interaction.deferUpdate();this.markAck();return value;}
  async showModal(modal){if(this.acknowledged())throw Object.assign(new Error('Interaction was already acknowledged.'),{code:'interaction_already_acknowledged'});const value=await this.interaction.showModal(modal);this.primary=true;this.markAck();return value;}
  finish(result='completed'){this.record.completedAt=new Date(this.clock()).toISOString();this.record.result=result;return {...this.record,ackMs:this.record.ackAt?Date.parse(this.record.ackAt)-this.startedAt:null,completionMs:this.record.completedAt?Date.parse(this.record.completedAt)-this.startedAt:null};}
  fail(error){this.record.errorCode=String(error?.code||'interaction_failed');const row=this.finish('failed');this.logger.error?.('Discord interaction failed',{...row,message:error?.message,referenceId:row.interactionId});return row;}
}
