const duration = (n, unit) => Number(n) * (/hour/.test(unit) ? 3600 : /min/.test(unit) ? 60 : 1);
// Deliberately bounded grammar: unsupported or ambiguous speech never becomes an order.
export function parseCampaignIntent(input) {
  const text = String(input).toLowerCase().trim().replace(/^wisdo[,\s]*/, '').replace(/[.!?]+$/, '');
  let m;
  if ((m = text.match(/^pause(?: new entries| entries)? for (\d+) (seconds?|minutes?|hours?)$/))) return { action: 'PAUSE_FOR', durationSeconds: duration(m[1], m[2]) };
  if ((m = text.match(/^after (?:a|each|every) win[,]? pause(?: for)? (\d+) (seconds?|minutes?|hours?)$/))) return { action: 'AFTER_WIN', durationSeconds: duration(m[1], m[2]) };
  if (/^after (?:a|each|every) compound(?: target| milestone)?[,]? (?:pause|wait) until (?:a )?(?:new )?(?:opposite|reversal) candle(?: closes| appears)?$/.test(text)) return { action: 'AFTER_COMPOUND' };
  if (/^(?:enter now|evaluate (?:an )?entry now)$/.test(text)) return { action: 'EVALUATE_ENTRY' };
  if (/^cancel (?:the |my )?(?:future goal|standing intention)$/.test(text)) return { action: 'CANCEL_GOAL' };
  if ((m = text.match(/^(?:end|close) (?:this |the )?campaign (?:in|after) (\d+) (seconds?|minutes?|hours?)$/))) return { action: 'END_AFTER', durationSeconds: duration(m[1], m[2]) };
  if ((m = text.match(/^after (?:this |the )?campaign ends[,]? pause(?: for)? (\d+) (seconds?|minutes?|hours?)$/))) return { action: 'AFTER_CAMPAIGN', durationSeconds: duration(m[1], m[2]) };
  if ((m = text.match(/^(?:prepare|arm) (?:a )?(ten|\d+)[ -](?:burst |trade )?sonic(?: attack| window)?(?: (?:for|on) the next valid entry)?$/))) return { action: 'ARM_SONIC', burstCount: m[1] === 'ten' ? 10 : Number(m[1]), durationSeconds: 900 };
  if (/^(?:promote|assign) (?:selected trades|selection) (?:to |as )?runners?$/.test(text)) return { action: 'ASSIGN_RUNNER' };
  if (/^(?:convert|assign) (?:selected trades|selection) (?:to |as )?collectors?$/.test(text)) return { action: 'ASSIGN_COLLECTOR' };
  if (/^(?:protect|tighten) (?:the |this )?campaign rail$/.test(text)) return { action: 'PROTECT_RAIL' };
  if ((m = text.match(/^extend (?:this runner|selected trades|selection) (one|two|three|four|five|\d+) levels?$/))) return { action: 'MOVE_TARGET', notches: Number(m[1]) || ({ one: 1, two: 2, three: 3, four: 4, five: 5 })[m[1]] };
  if (/^make (?:selected trades|selection|this runner) (?:a )?structure keeper$/.test(text)) return { action: 'TRAIL_STRUCTURE' };
  if (/^(?:use|apply) profit vault (?:on|to) (?:selected trades|selection)$/.test(text)) return { action: 'TRAIL_PROFIT' };
  throw new Error('I need a supported, unambiguous instruction. Try “pause entries for 1 hour”, “after each win pause 15 minutes”, or choose an action below. Nothing was sent.');
}
