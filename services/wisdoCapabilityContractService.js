export const EA_CAPABILITY_CONTRACTS = Object.freeze({
  PRESERVE_RUNNER: { capability:'preserveRunner', commandName:'WISDO_PRESERVE_RUNNER', safety:'CONTROLLED', payload:{count:'integer >= 1'}, globals:['WISDO_RUNNER_COUNT'], receipt:['selectedTickets','remainingCount'] },
  TRAIL_RUNNER_GIVEBACK: { capability:'trailRunnerGiveback', commandName:'WISDO_TRAIL_RUNNER', safety:'CONTROLLED', payload:{givebackPercent:'number 0..100'}, globals:['WISDO_RUNNER_GIVEBACK_PERCENT'], receipt:['modifiedTickets','stopLosses'] },
  STOP_AFTER_NEXT_TRADE: { capability:'stopAfterNextTrade', commandName:'WISDO_STOP_AFTER_NEXT', safety:'CONTROLLED', payload:{scope:'account|bot'}, globals:['WISDO_STOP_AFTER_NEXT'], receipt:['armed','triggerTicket'] },
  STOP_AFTER_CURRENT_TRADE: { capability:'stopAfterCurrentTrade', commandName:'WISDO_STOP_AFTER_CURRENT', safety:'CONTROLLED', payload:{scope:'account|bot'}, globals:['WISDO_STOP_AFTER_CURRENT'], receipt:['armed','watchedTickets'] },
  NEWS_AVOIDANCE: { capability:'newsAvoidance', commandName:'WISDO_SET_NEWS_AVOIDANCE', safety:'CONTROLLED', payload:{minutesBefore:'integer',minutesAfter:'integer'}, globals:['WISDO_NEWS_BEFORE_MINUTES','WISDO_NEWS_AFTER_MINUTES'], receipt:['calendarSource','blockedUntil'] },
  LADDER_AWARE_ACTION: { capability:'ladderAwareActions', commandName:'WISDO_LADDER_ACTION', safety:'DANGEROUS', payload:{action:'close|preserve|trail',ladderId:'string'}, globals:[], receipt:['ladderId','affectedTickets'] },
  TRADE_EXPLANATION: { capability:'tradeExplanation', commandName:'WISDO_EXPLAIN_TRADE', safety:'READ_ONLY', payload:{ticket:'string'}, globals:[], receipt:['ticket','explanation','inputs'] },
});

export class WisdoCapabilityContractService {
  contract(intent){return EA_CAPABILITY_CONTRACTS[intent]||null;}
  supported(account,intent){const contract=this.contract(intent);return Boolean(contract&&account?.capabilities?.[contract.capability]);}
  unsupportedMessage(intent){const contract=this.contract(intent);return `I understand the ${String(intent).toLowerCase().replaceAll('_',' ')} request, but the connected EA does not advertise ${contract?.capability||'that capability'}. I did not make any changes.`;}
}
