import { parseNumericValue } from '../utils/operatorDesk.js';

const SEVERITY_ORDER = {
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4,
};

function normalizeText(...values) {
  return values
    .flat()
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())
    .join(' ');
}

function hasKeywords(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function uniqueList(items, limit = 3) {
  return [...new Set(items.filter(Boolean))].slice(0, limit);
}

function highestSeverity(findings) {
  return findings.reduce((highest, finding) => {
    if (SEVERITY_ORDER[finding.severity] > SEVERITY_ORDER[highest]) {
      return finding.severity;
    }

    return highest;
  }, 'Low');
}

function buildDirectionalThresholdCheck({
  rawValue,
  numericValue,
  amount,
  percent,
  direction,
}) {
  if (!rawValue && numericValue === null) {
    return {
      hit: false,
      near: false,
      thresholdValue: null,
      unit: null,
    };
  }

  const raw = String(rawValue || '').trim();
  const usesPercent = raw.includes('%');
  const thresholdValue = numericValue ?? parseNumericValue(raw);
  const sourceValue = usesPercent ? percent : amount;

  if (!Number.isFinite(thresholdValue) || !Number.isFinite(sourceValue)) {
    return {
      hit: false,
      near: false,
      thresholdValue,
      unit: usesPercent ? 'percent' : 'amount',
    };
  }

  const comparator =
    direction === 'positive'
      ? Math.max(sourceValue, 0)
      : Math.abs(Math.min(sourceValue, 0));

  return {
    hit: comparator >= thresholdValue,
    near: comparator > 0 && comparator >= thresholdValue * 0.9,
    thresholdValue,
    unit: usesPercent ? 'percent' : 'amount',
  };
}

function formatThresholdResult(result) {
  if (!Number.isFinite(result.thresholdValue)) {
    return null;
  }

  return result.unit === 'percent'
    ? `${result.thresholdValue}%`
    : `$${result.thresholdValue.toFixed(2)}`;
}

function countByType(trades, type) {
  return trades.filter((trade) => trade.type === type).length;
}

function truncate(value, maxLength = 120) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3).trim()}...`;
}

export class WisdoRulesEngine {
  constructor(config) {
    this.config = config;
  }

  analyze(context) {
    const findings = [];
    const positives = [];

    const liveMt4Snapshot = context.mt4.freshSnapshot?.snapshot || null;
    const mt4Fresh = Boolean(context.mt4.freshSnapshot);
    const latestEaLog = context.today.latestEaLog;
    const latestCoachNote = context.coachNotes[0] || null;
    const clockIn = context.today.clockIn;
    const clockOut = context.today.clockOut;
    const todayLogs = context.today.logs;
    const weeklyStats = context.week.stats;
    const profile = context.profile;

    const latestBalance = liveMt4Snapshot?.balance ?? latestEaLog?.balanceValue ?? null;
    const latestEquity = liveMt4Snapshot?.equity ?? latestEaLog?.equityValue ?? null;
    const latestFloatingPl = liveMt4Snapshot?.floatingPL ?? latestEaLog?.floatingPl ?? null;
    const latestOpenTrades =
      liveMt4Snapshot?.openTradeCount ??
      parseNumericValue(latestEaLog?.openTrades) ??
      0;
    const latestBuyTrades = liveMt4Snapshot?.buyTradeCount ?? countByType(liveMt4Snapshot?.openTrades || [], 'buy');
    const latestSellTrades = liveMt4Snapshot?.sellTradeCount ?? countByType(liveMt4Snapshot?.openTrades || [], 'sell');
    const totalLots = liveMt4Snapshot?.totalLots ?? latestEaLog?.totalLots ?? null;
    const currentProfitAmount = this.getCurrentProfitAmount(context);
    const currentProfitPercent = this.getCurrentProfitPercent(context, currentProfitAmount);

    const dailyTargetCheck = buildDirectionalThresholdCheck({
      rawValue: clockIn?.dailyTarget || profile?.dailyGoal,
      numericValue: clockIn?.dailyTargetValue ?? parseNumericValue(profile?.dailyGoal),
      amount: currentProfitAmount,
      percent: currentProfitPercent,
      direction: 'positive',
    });
    const maxLossCheck = buildDirectionalThresholdCheck({
      rawValue: clockIn?.maxLoss || profile?.maxDailyLoss,
      numericValue: clockIn?.maxLossValue ?? parseNumericValue(profile?.maxDailyLoss),
      amount: currentProfitAmount,
      percent: currentProfitPercent,
      direction: 'negative',
    });

    const drawdownPercent =
      latestBalance && latestEquity !== null ? ((latestBalance - latestEquity) / latestBalance) * 100 : null;

    const actionText = normalizeText(
      todayLogs.map((log) => log.studentAction),
      todayLogs.map((log) => log.eaAction),
      todayLogs.map((log) => log.marketBehavior),
      todayLogs.map((log) => log.questionForCoach),
      clockOut?.mistakeMade,
      clockOut?.lessonLearned,
      clockOut?.tomorrowsAdjustment,
    );
    const marketText = normalizeText(
      clockIn?.marketBias,
      todayLogs.map((log) => log.marketBehavior),
      profile?.tradingPair,
    );

    if (!profile) {
      findings.push({
        id: 'missing-profile',
        severity: 'Medium',
        summary: 'No saved profile is on file yet, so WISDO is reading lighter context than it could.',
        suggestions: [
          'Consider running /setup-profile before the next active session.',
          'Save your default risk and session details so repeated entries stay clean.',
          'Use the profile to keep your desk process tighter from day to day.',
        ],
        lesson: 'A clean profile reduces friction and protects consistency.',
      });
    }

    if (dailyTargetCheck.hit || clockOut?.goalHit === 'Yes' || clockOut?.calculatedGoalReached === true) {
      findings.push({
        id: 'daily-target-hit',
        severity: 'Low',
        summary: "You got the day. Don't give it back trying to prove something.",
        suggestions: [
          'Consider ending the session here and protecting the win.',
          'Clock out clean and let the journal close the loop.',
          'Avoid giving the day back by forcing extra trades.',
        ],
        lesson: 'Once the daily target is met, the flex is in stopping clean.',
      });
      positives.push('The day target looks handled. Protecting the win is the next skill.');
    }

    if (maxLossCheck.hit) {
      findings.push({
        id: 'max-loss-hit',
        severity: 'Critical',
        summary: "That max loss line is not decoration. That's the guardrail.",
        suggestions: [
          'Consider stopping for the session here.',
          'Pause the EA if your rules allow it.',
          'Do not take revenge entries after the limit is touched.',
        ],
        lesson: 'Respecting the loss limit is part of being an operator.',
      });
    } else if (maxLossCheck.near) {
      findings.push({
        id: 'max-loss-near',
        severity: 'High',
        summary: `Loss is leaning too close to the max-loss line${formatThresholdResult(maxLossCheck) ? ` (${formatThresholdResult(maxLossCheck)})` : ''}.`,
        suggestions: [
          'Consider stopping new adds until the pressure comes down.',
          'Pause the EA for the session if the loss keeps stretching.',
          'Review the setup before you press anything else.',
        ],
        lesson: 'Near max loss is the moment to tighten process, not negotiate with it.',
      });
    }

    if (latestFloatingPl !== null && latestFloatingPl < 0) {
      findings.push({
        id: 'floating-drawdown',
        severity:
          drawdownPercent !== null && drawdownPercent >= this.config.wisdo.drawdownDangerPercent
            ? 'Critical'
            : drawdownPercent !== null && drawdownPercent >= this.config.wisdo.drawdownWarnPercent
              ? 'High'
              : 'Medium',
        summary:
          drawdownPercent !== null
            ? `Basket getting heavy. Equity is ${drawdownPercent.toFixed(2)}% off balance.`
            : 'Basket getting heavy. Floating P/L is negative and deserves respect.',
        suggestions: [
          'Consider reducing exposure if the basket keeps stretching.',
          'Do not add more entries right now.',
          'Watch equity, not just balance, while the basket is under pressure.',
        ],
        lesson: 'Drawdown deserves calm decisions before it becomes damage.',
      });
    }

    if (latestOpenTrades > this.config.wisdo.maxSafeOpenTrades) {
      findings.push({
        id: 'too-many-open-trades',
        severity: latestOpenTrades >= this.config.wisdo.maxSafeOpenTrades + 2 ? 'High' : 'Medium',
        summary: `${latestOpenTrades} open trades is above the current safety threshold of ${this.config.wisdo.maxSafeOpenTrades}.`,
        suggestions: [
          'Consider holding off on new manual entries right now.',
          'Monitor the basket before adding any more risk.',
          'Let equity recover before you think about anything new.',
        ],
        lesson: 'More tickets does not automatically mean more control.',
      });
    }

    if (latestBuyTrades > 0 && latestSellTrades > 0) {
      findings.push({
        id: 'buy-sell-conflict',
        severity: 'High',
        summary: 'Buy and sell exposure are both open right now. Review whether this is a hedge or a conflict.',
        suggestions: [
          'Avoid adding both ways until direction is clearer.',
          'Review the basket for hedge conflict before pressing again.',
          'Coach review is recommended before more exposure gets added.',
        ],
        lesson: 'Conflicted direction usually means slower hands, not faster buttons.',
      });
    }

    if (
      hasKeywords(actionText, [
        'manual close',
        'manual entry',
        'revenge',
        'fear',
        'early close',
        'moved tp',
        'moved sl',
        'override',
        'panic',
        'rushed',
      ])
    ) {
      findings.push({
        id: 'manual-interference',
        severity: hasKeywords(actionText, ['revenge', 'panic', 'rushed']) ? 'Critical' : 'High',
        summary: 'Manual interference language is showing up in the desk notes. Slow the hands before you keep touching the system.',
        suggestions: [
          'Document the reason before you touch the basket again.',
          'Do not keep adjusting trades outside the written rule set.',
          'Bring Coach into the review before the same pattern repeats.',
        ],
        lesson: 'The moment emotion starts steering the hands, process has to get louder.',
      });
    }

    if (
      hasKeywords(actionText, [
        'account danger',
        'blow the account',
        'blown the account',
        'bleeding',
        'margin call',
        'danger drawdown',
      ])
    ) {
      findings.push({
        id: 'account-danger-language',
        severity: 'Critical',
        summary: 'Your notes are reading like account danger is in the room. That needs immediate respect.',
        suggestions: [
          'Consider shutting the session down and protecting what is left.',
          'Pause the EA if your rules allow it while you review exposure.',
          'Coach review is recommended before any more risk is taken.',
        ],
        lesson: 'When the language gets desperate, the process has to get stricter.',
      });
    }

    if (hasKeywords(marketText, ['chop', 'choppy', 'range', 'sideways', 'messy', 'no direction', 'consolidation'])) {
      findings.push({
        id: 'choppy-market',
        severity: 'Medium',
        summary: 'Market is chopping and the structure looks messy.',
        suggestions: [
          'Consider reducing risk in this condition.',
          'Pause aggressive adds until structure clears.',
          'Let the EA sit if the market keeps searching.',
        ],
        lesson: 'Messy structure is where discipline saves more than prediction.',
      });
    }

    if (
      hasKeywords(marketText, ['trend', 'clean', 'structure', 'following direction']) ||
      hasKeywords(actionText, ['in profit', 'following direction', 'let the ea work', 'clean flow'])
    ) {
      findings.push({
        id: 'clean-trend',
        severity: 'Low',
        summary: 'This flow looks cleaner than average and the basket is not showing obvious stress.',
        suggestions: [
          'Consider letting the EA work while the setup stays clean.',
          'Protect profit according to the rule set if price keeps extending.',
          'Avoid emotional exits while structure is still behaving.',
        ],
        lesson: 'When the setup is clean, discipline often means doing less, not more.',
      });
      positives.push('The setup reads cleaner than average. No need to wrestle a trade that is already behaving.');
    }

    if (!clockIn && (context.today.eaLogs.length > 0 || Boolean(clockOut) || (mt4Fresh && latestOpenTrades > 0))) {
      findings.push({
        id: 'no-clock-in',
        severity: 'High',
        summary: 'No clock-in was found before active session logging.',
        suggestions: [
          'Make the next session start with /clock-in before trading.',
          'Paper the plan before you start touching the market.',
          'Keep the process honest from the first move.',
        ],
        lesson: 'No clock-in, no review. Operators start with the plan on paper.',
      });
    }

    if (context.previousDay.missedClockOut) {
      findings.push({
        id: 'missed-clock-out',
        severity: 'Medium',
        summary: `There was a clock-in on ${context.previousDay.dateKey} without a matching clock-out.`,
        suggestions: [
          'Close the loop on every session review.',
          'Complete the missing journal process before another active day stacks up.',
          'Tighten end-of-day discipline before tomorrow starts.',
        ],
        lesson: 'Clock-out is not optional paperwork. It is where the lesson gets captured.',
      });
    }

    const profitGiveback = this.detectProfitGiveback(context, currentProfitAmount);
    if (profitGiveback) {
      findings.push({
        id: 'profit-giveback',
        severity: 'High',
        summary: `You had more on the table earlier and gave back about $${profitGiveback.toFixed(2)} before the close.`,
        suggestions: [
          'Review where profit was not protected.',
          'Consider a trim or partial rule for future baskets.',
          'Tighten the clock-out discipline once target gets touched.',
        ],
        lesson: 'Keeping profit is part of the skill, not an afterthought.',
      });
    }

    if (liveMt4Snapshot?.balance && totalLots !== null) {
      const lotsPerThousand = totalLots / Math.max(liveMt4Snapshot.balance / 1000, 0.001);
      if (lotsPerThousand >= 0.5) {
        findings.push({
          id: 'account-overextension',
          severity: 'Critical',
          summary: `Lot exposure is running hot for the current balance (${totalLots} lots on ${liveMt4Snapshot.balance.toFixed(2)} balance).`,
          suggestions: [
            'Consider reducing lot exposure before anything else is added.',
            'Pause the EA if your rules allow it.',
            'Do not add more size into an extended basket.',
          ],
          lesson: 'Size is a risk tool, not a flex.',
        });
      } else if (lotsPerThousand >= 0.3) {
        findings.push({
          id: 'account-overextension-warning',
          severity: 'High',
          summary: `Total lot size is getting stretched relative to balance (${totalLots} lots).`,
          suggestions: [
            'Consider keeping lot exposure contained from here.',
            'Do not layer more positions until the basket breathes.',
            'Review the size plan before the next push.',
          ],
          lesson: 'Exposure compounds faster than confidence realizes.',
        });
      }
    }

    if (context.mt4.latestSnapshot && context.mt4.freshness.isStale) {
      findings.push({
        id: 'stale-mt4-data',
        severity: context.mt4.freshness.ageMinutes >= this.config.wisdo.mt4StaleMinutes * 2 ? 'High' : 'Medium',
        summary: `The last MT4 snapshot is stale (${context.mt4.freshness.ageMinutes.toFixed(1)} minutes old).`,
        suggestions: [
          'Check the terminal connection before you lean on MT4 data.',
          'Check the MT4 WebRequest whitelist and the reporter EA.',
          'Do not trust stale account data blindly.',
        ],
        lesson: 'Fresh data matters when risk is moving in real time.',
      });
    }

    if (latestCoachNote?.whatWentWell) {
      positives.push(`Coach noticed this strength: ${truncate(latestCoachNote.whatWentWell)}`);
    }

    if (latestCoachNote?.riskWarning) {
      findings.push({
        id: 'coach-risk-warning',
        severity: 'Medium',
        summary: `Coach already flagged this pattern: ${truncate(latestCoachNote.riskWarning)}`,
        suggestions: [
          latestCoachNote.actionStep
            ? `Consider this coach action step next: ${truncate(latestCoachNote.actionStep, 90)}`
            : 'Bring the latest coach warning into the next session plan.',
          'Do not ignore the coach note while the same pattern is still live.',
          'Let the coach feedback shape the next session rule.',
        ],
        lesson:
          latestCoachNote.botSkillLesson
            ? truncate(latestCoachNote.botSkillLesson, 160)
            : 'Coach notes are part of the operating manual, not background noise.',
      });
    } else if (latestCoachNote?.actionStep) {
      positives.push(`Coach action step is clear: ${truncate(latestCoachNote.actionStep)}`);
    }

    if (!context.mt4.latestSnapshot) {
      positives.push("MT4 sync is not connected yet, so I'm reading the manual desk logs only.");
    }

    if (!findings.length && clockIn && !clockOut) {
      positives.push('Process looks orderly so far. Stay with the written plan and let the session develop.');
    }

    if (weeklyStats.clockInCount > 0 && weeklyStats.clockInCount === weeklyStats.clockOutCount) {
      positives.push('Clock-ins and clock-outs are matching this week. That process consistency matters.');
    }

    const riskLevel = findings.length ? highestSeverity(findings) : 'Low';
    const sortedFindings = findings.sort((left, right) => SEVERITY_ORDER[right.severity] - SEVERITY_ORDER[left.severity]);
    const topFinding = sortedFindings[0] || null;
    const suggestions = uniqueList(sortedFindings.flatMap((finding) => finding.suggestions), 3);
    const corrections = uniqueList(
      sortedFindings
        .filter((finding) => !['daily-target-hit', 'clean-trend'].includes(finding.id))
        .map((finding) => finding.summary),
      3,
    );
    const highFindingCount = sortedFindings.filter((finding) => finding.severity === 'High').length;
    const mediumFindingCount = sortedFindings.filter((finding) => finding.severity === 'Medium').length;

    const coachFlag =
      riskLevel === 'Critical'
        ? 'Urgent Review'
        : this.config.wisdo.strongWarningsEnabled && highFindingCount >= 2
          ? 'Urgent Review'
          : riskLevel === 'High' || mediumFindingCount >= 2
            ? 'Review Recommended'
            : 'None';

    return {
      riskLevel,
      findings: sortedFindings,
      topFinding,
      suggestions,
      positives: uniqueList(positives, 3),
      corrections,
      coachFlag,
      lesson:
        topFinding?.lesson ||
        positives[0] ||
        'Stay disciplined, respect the plan, and let the journal tell the truth.',
      metrics: {
        currentProfitAmount,
        currentProfitPercent,
        latestOpenTrades,
        latestFloatingPl,
        drawdownPercent,
        mt4Fresh,
      },
    };
  }

  getCurrentProfitAmount(context) {
    const clockOut = context.today.clockOut;
    if (typeof clockOut?.profitLoss === 'number') {
      return clockOut.profitLoss;
    }

    const startBalance = context.today.clockIn?.startingBalanceValue;
    const mt4Snapshot = context.mt4.freshSnapshot?.snapshot || null;

    if (startBalance !== null && startBalance !== undefined && mt4Snapshot) {
      const realized = mt4Snapshot.balance !== null ? mt4Snapshot.balance - startBalance : null;
      if (realized !== null) {
        return realized + (mt4Snapshot.floatingPL || 0);
      }
    }

    return null;
  }

  getCurrentProfitPercent(context, profitAmount) {
    const clockOut = context.today.clockOut;
    if (typeof clockOut?.profitLossPercent === 'number') {
      return clockOut.profitLossPercent;
    }

    const startBalance = context.today.clockIn?.startingBalanceValue;
    if (!startBalance || profitAmount === null) {
      return null;
    }

    return (profitAmount / startBalance) * 100;
  }

  detectProfitGiveback(context, finalProfitAmount) {
    if (finalProfitAmount === null) {
      return null;
    }

    const startBalance = context.today.clockIn?.startingBalanceValue;
    if (!startBalance) {
      return null;
    }

    const candidateProfits = [];

    for (const log of context.today.eaLogs) {
      if (typeof log.balanceValue === 'number') {
        candidateProfits.push(log.balanceValue - startBalance);
      }

      if (typeof log.equityValue === 'number') {
        candidateProfits.push(log.equityValue - startBalance);
      }
    }

    for (const record of context.mt4.historyToday) {
      const snapshot = record.snapshot;
      if (typeof snapshot.balance === 'number') {
        candidateProfits.push((snapshot.balance - startBalance) + (snapshot.floatingPL || 0));
      }
    }

    const peakProfit = candidateProfits.length ? Math.max(...candidateProfits) : null;

    if (peakProfit === null || peakProfit <= finalProfitAmount) {
      return null;
    }

    const protectThreshold = (startBalance * this.config.wisdo.profitProtectPercent) / 100;
    const giveback = peakProfit - finalProfitAmount;

    return giveback >= protectThreshold ? giveback : null;
  }
}
