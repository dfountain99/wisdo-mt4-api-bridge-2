function checksum(input) {
  return [...String(input || '')].reduce((total, character) => total + character.charCodeAt(0), 0);
}

export class WisdoToneService {
  constructor(config) {
    this.config = config;
    this.library = {
      targetHit: [
        "You got the day. Don't give it back.",
        "That's a complete workday. Clock out with discipline.",
        "Don't turn a blessing into a lesson.",
      ],
      drawdown: [
        'Basket getting heavy.',
        'Equity is leaning away from balance.',
        'This is where we protect the account, not prove a point.',
      ],
      overtrading: [
        'Hands off the buttons for a second.',
        'Let the EA breathe.',
        "Don't chase the candle after the candle already ran.",
      ],
      cleanSetup: [
        'This is clean. Let the system work.',
        'No need to wrestle a trade that is already behaving.',
        'The bot got rhythm right now.',
      ],
      missingProcess: [
        'No clock-in, no review. We trade like operators over here.',
        'The process protects you when emotions get loud.',
        'Paper the plan before you press the day.',
      ],
      encouragement: [
        'You are learning the machine, not fighting it.',
        'Discipline is the skill before profit is the result.',
        'We are building an operator, not a button-clicker.',
      ],
      caution: [
        'Slow the hands for a second.',
        "Ain't no trophy for forcing the day.",
        'Respect the guardrails before emotion starts bargaining.',
      ],
      choppy: [
        'Market is chopping. Let the noise clear before you press.',
        'This tape is messy. No reason to force precision in a blender.',
        'Sideways money is where students start donating focus.',
      ],
      coach: [
        'Coach review recommended before you keep pressing.',
        'Bring Coach into this one if the basket keeps stretching.',
        'This deserves a second set of eyes from Coach.',
      ],
      protect: [
        'Protect the day.',
        'Hold the line on risk.',
        'Keep the account first.',
      ],
      urgent: [
        'This one needs a hard pause and a coach look before the next move.',
        'Protect the account first and let Coach step into the review.',
        'This is not the moment to freestyle. Stop and get the review.',
      ],
    };
  }

  pick(category, seed = '') {
    const phrases = this.library[category] || this.library.encouragement;
    return phrases[checksum(`${category}:${seed}`) % phrases.length];
  }

  buildQuickSummary({ studentName, riskLevel, topFinding, mt4Fresh, manualOnly, suggestions }) {
    const intro = manualOnly
      ? "MT4 sync is not connected yet, so I'm reading your manual logs only."
      : mt4Fresh
        ? "Alright young bull, I'm reading the MT4 snapshot with your desk logs."
        : 'I can see the MT4 connection history, but the latest snapshot is stale so I am weighting the manual desk logs more heavily.';

    const middle = topFinding?.summary
      ? topFinding.summary
      : riskLevel === 'Low'
        ? `${this.pick('cleanSetup', studentName)} ${this.pick('encouragement', studentName)}`
        : `${this.pick('caution', studentName)} ${this.pick('protect', studentName)}`;

    const suggestionLine = suggestions.length
      ? `Right now: ${suggestions.slice(0, 2).join(' ')}`
      : this.pick('encouragement', studentName);

    return `${intro} ${middle} ${suggestionLine}`.trim();
  }

  buildTeachingParagraph({ studentName, riskLevel, positives, corrections, period }) {
    const positiveLead = positives.length
      ? positives[0]
      : this.pick('encouragement', `${studentName}:${period}`);
    const correctionLead = corrections.length
      ? corrections[0]
      : this.pick('protect', `${studentName}:${period}`);

    if (riskLevel === 'Low') {
      return `${this.pick('cleanSetup', `${studentName}:${period}`)} ${positiveLead} Keep stacking boring discipline and let the process stay louder than emotion.`;
    }

    if (riskLevel === 'Critical') {
      return `${this.pick('caution', `${studentName}:${period}`)} ${correctionLead} ${this.pick('coach', `${studentName}:${period}`)} The lesson is account protection first, ego last.`;
    }

    return `${positiveLead} ${correctionLead} ${this.pick('encouragement', `${studentName}:${period}`)}`;
  }

  buildAutoReply({ trigger, riskLevel, topFinding, studentName, suggestions, coachFlag }) {
    const key = `${studentName}:${trigger}:${riskLevel}:${topFinding?.id || 'none'}`;
    const baseByTrigger = {
      'clock-in':
        riskLevel === 'Low'
          ? `WISDO: ${this.pick('cleanSetup', key)}`
          : topFinding?.id === 'no-clock-in'
            ? `WISDO: ${this.pick('missingProcess', key)}`
            : `WISDO: ${this.pick('caution', key)}`,
      'ea-log':
        topFinding?.id === 'clean-trend'
          ? `WISDO: ${this.pick('cleanSetup', key)}`
          : riskLevel === 'Low'
            ? `WISDO: ${this.pick('encouragement', key)}`
            : `WISDO: ${this.pick('drawdown', key)}`,
      'clock-out':
        topFinding?.id === 'daily-target-hit'
          ? `WISDO: ${this.pick('targetHit', key)}`
          : riskLevel === 'Low'
            ? `WISDO: ${this.pick('encouragement', key)}`
            : `WISDO: ${this.pick('protect', key)}`,
      'weekly-review': `WISDO: ${this.pick('encouragement', key)}`,
    };

    let message = baseByTrigger[trigger] || `WISDO: ${this.pick('encouragement', key)}`;

    if (topFinding?.summary) {
      message = `${message} ${topFinding.summary}`;
    }

    if (suggestions.length) {
      message = `${message} ${suggestions[0]}`;
    }

    if (coachFlag === 'Urgent Review') {
      message = `${message} ${this.config.wisdo.strongWarningsEnabled ? this.pick('urgent', key) : this.pick('coach', key)}`;
    } else if (coachFlag === 'Review Recommended') {
      message = `${message} ${this.pick('coach', key)}`;
    }

    return message.trim();
  }
}
