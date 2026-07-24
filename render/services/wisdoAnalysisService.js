import { EmbedBuilder } from 'discord.js';

import { logger } from '../logger.js';
import { formatCurrency, formatPercent } from '../utils/operatorDesk.js';
import { getDateKey, getDateLabel, getWeekRange } from '../utils/time.js';

function sortByTimestampDescending(left, right) {
  return new Date(right.timestamp || right.receivedAt) - new Date(left.timestamp || left.receivedAt);
}

function buildNumberedList(items) {
  if (!items.length) {
    return 'None';
  }

  return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getPeriodLabel(period, weekRange) {
  return period === 'week'
    ? `${getDateLabel(weekRange.start)} - ${getDateLabel(weekRange.end)}`
    : getDateLabel();
}

function matchesDateKey(value, expectedDateKey) {
  if (!value) {
    return false;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value).startsWith(expectedDateKey);
  }

  return getDateKey(parsed) === expectedDateKey;
}

export class WisdoAnalysisService {
  constructor({ config, repository, operatorDeskService, mt4SyncService, rulesEngine, toneService }) {
    this.config = config;
    this.repository = repository;
    this.operatorDeskService = operatorDeskService;
    this.mt4SyncService = mt4SyncService;
    this.rulesEngine = rulesEngine;
    this.toneService = toneService;
  }

  isEnabled() {
    return this.config.wisdo.enabled;
  }

  async getAnalysisContext(guild, discordUserId, period = 'today') {
    const todayKey = getDateKey();
    const weekRange = getWeekRange();
    const [student, profile, allLogs, mt4Status, weeklyStats, weeklyReview] = await Promise.all([
      this.operatorDeskService.getStudentDisplay(guild, discordUserId),
      this.repository.getProfile(discordUserId),
      this.repository.getAllLogs(),
      this.mt4SyncService.getDeskMt4Status(discordUserId),
      this.operatorDeskService.buildWeeklyStats(discordUserId),
      this.operatorDeskService.getWeeklyReviewLog(discordUserId, weekRange.startKey),
    ]);

    const logsForUser = allLogs.filter((log) => log.discordUserId === discordUserId).sort(sortByTimestampDescending);
    const coachNotes = allLogs
      .filter((log) => log.logType === 'coach-note' && log.studentUserId === discordUserId)
      .sort(sortByTimestampDescending);

    const todayLogs = logsForUser.filter((log) => log.date === todayKey);
    const weekLogs = logsForUser.filter((log) => {
      if (!log.date) {
        return false;
      }

      return log.date >= weekRange.startKey && log.date <= weekRange.endKey;
    });

    const previousDayKey = new Date();
    previousDayKey.setDate(previousDayKey.getDate() - 1);
    const previousKey = getDateKey(previousDayKey);
    const previousDayLogs = logsForUser.filter((log) => log.date === previousKey);

    const latestClockIn = todayLogs.find((log) => log.logType === 'clock-in') || null;
    const latestClockOut = todayLogs.find((log) => log.logType === 'clock-out') || null;
    const todayEaLogs = todayLogs.filter((log) => log.logType === 'ea-log').sort((left, right) => new Date(left.timestamp) - new Date(right.timestamp));
    const latestEaLog = [...todayEaLogs].sort(sortByTimestampDescending)[0] || null;

    const freshSnapshot = this.mt4SyncService.getFreshnessInfo(mt4Status.latestSnapshot).isFresh
      ? mt4Status.latestSnapshot
      : null;
    const historyToday = mt4Status.snapshotHistory.filter((record) =>
      matchesDateKey(record.receivedAt || record.snapshot?.timestamp, todayKey),
    );

    return {
      student,
      profile,
      today: {
        dateKey: todayKey,
        logs: todayLogs,
        clockIn: latestClockIn,
        clockOut: latestClockOut,
        eaLogs: todayEaLogs,
        latestEaLog,
      },
      week: {
        range: weekRange,
        logs: weekLogs,
        stats: weeklyStats,
        review: weeklyReview,
      },
      coachNotes,
      previousDay: {
        dateKey: previousKey,
        missedClockOut:
          previousDayLogs.some((log) => log.logType === 'clock-in') &&
          !previousDayLogs.some((log) => log.logType === 'clock-out'),
      },
      mt4: {
        pairing: mt4Status.pairing,
        connection: mt4Status.connection,
        latestSnapshot: mt4Status.latestSnapshot,
        freshSnapshot,
        history: mt4Status.snapshotHistory,
        historyToday,
        freshness: mt4Status.freshness,
      },
      period,
    };
  }

  buildDataUsed(context) {
    const dataUsed = [context.profile ? 'Profile' : 'Profile (Missing)'];

    if (context.today.clockIn) {
      dataUsed.push('Clock-In');
    }

    if (context.today.eaLogs.length) {
      dataUsed.push('EA Logs');
    }

    if (context.today.clockOut) {
      dataUsed.push('Clock-Out');
    }

    if (context.week.review) {
      dataUsed.push('Weekly Review');
    }

    if (context.coachNotes.length) {
      dataUsed.push('Coach Notes');
    }

    if (context.mt4.freshSnapshot) {
      dataUsed.push('MT4 Snapshot');
    } else if (context.mt4.latestSnapshot) {
      dataUsed.push('MT4 Snapshot (Stale)');
    }

    return dataUsed;
  }

  async analyzeCurrentDesk(guild, discordUserId) {
    const context = await this.getAnalysisContext(guild, discordUserId, 'today');
    const rules = this.rulesEngine.analyze(context);
    const dataUsed = this.buildDataUsed(context);
    const mode = context.mt4.freshSnapshot
      ? 'Manual + MT4'
      : context.mt4.latestSnapshot
        ? 'Manual + stale MT4 reference'
        : 'Manual only';

    return {
      context,
      rules,
      dataUsed,
      mode,
      currentRead: this.toneService.buildQuickSummary({
        studentName: context.student.username,
        riskLevel: rules.riskLevel,
        topFinding: rules.topFinding,
        mt4Fresh: Boolean(context.mt4.freshSnapshot),
        manualOnly: !context.mt4.latestSnapshot,
        suggestions: rules.suggestions,
      }),
      studentLesson: rules.lesson,
      note: 'WISDO gives coaching suggestions only. It does not place or manage trades.',
    };
  }

  buildDisciplineScore(context, rules, period) {
    let score = 70;

    if (period === 'today') {
      if (context.today.clockIn) {
        score += 10;
      }

      if (context.today.clockOut) {
        score += 10;
      }
    } else {
      score += Math.min(context.week.stats.clockInCount * 2, 10);
      score += Math.min(context.week.stats.clockOutCount * 2, 10);
    }

    if (context.previousDay.missedClockOut) {
      score -= 12;
    }

    if (rules.findings.some((finding) => finding.id === 'no-clock-in')) {
      score -= 18;
    }

    if (rules.findings.some((finding) => finding.id === 'manual-interference')) {
      score -= 14;
    }

    if (rules.riskLevel === 'Critical') {
      score -= 14;
    } else if (rules.riskLevel === 'High') {
      score -= 8;
    }

    return clamp(score, 0, 100);
  }

  buildPerformanceRead(context, rules, period) {
    if (period === 'week') {
      if (typeof context.week.stats.weeklyProfitLoss !== 'number') {
        return 'Weekly performance read is limited because full balance data is not on file for the whole week yet.';
      }

      return `Weekly P/L is ${formatCurrency(context.week.stats.weeklyProfitLoss)} with growth at ${formatPercent(context.week.stats.weeklyGrowth)}.`;
    }

    if (typeof rules.metrics.currentProfitAmount === 'number') {
      return `Current session read is ${formatCurrency(rules.metrics.currentProfitAmount)} at ${formatPercent(rules.metrics.currentProfitPercent)}.`;
    }

    return 'Performance read is based on process notes more than hard account numbers right now.';
  }

  buildRiskRead(rules) {
    if (rules.topFinding?.summary) {
      return `${rules.riskLevel} risk. ${rules.topFinding.summary}`;
    }

    return `${rules.riskLevel} risk. No major pressure points are showing right now.`;
  }

  buildEaOperationRead(context, rules) {
    if (context.mt4.freshSnapshot?.snapshot) {
      const snapshot = context.mt4.freshSnapshot.snapshot;
      return `MT4 shows ${snapshot.openTradeCount} open trades, floating P/L at ${formatCurrency(snapshot.floatingPL)}, and total lots at ${snapshot.totalLots ?? 'N/A'}.`;
    }

    if (context.mt4.latestSnapshot?.snapshot) {
      return 'MT4 sync exists, but the latest snapshot is stale, so this read leans more on the desk notes than live account data.';
    }

    if (context.today.latestEaLog) {
      return `Latest EA log says: ${context.today.latestEaLog.eaAction || 'No action note recorded.'}`;
    }

    return rules.positives[0] || 'EA operation read is limited because the desk has light data today.';
  }

  async analyzeReview(guild, discordUserId, period = 'today') {
    const context = await this.getAnalysisContext(guild, discordUserId, period);
    const rules = this.rulesEngine.analyze(context);
    const disciplineScore = this.buildDisciplineScore(context, rules, period);
    const positives = rules.positives.length
      ? rules.positives
      : ['You showed up to the desk and kept data on paper.'];
    const corrections = rules.corrections.length
      ? rules.corrections
      : ['Keep the process steady and consistent.'];

    return {
      context,
      rules,
      period,
      logsReviewed: period === 'week' ? context.week.logs.length : context.today.logs.length,
      disciplineScore,
      performanceRead: this.buildPerformanceRead(context, rules, period),
      disciplineRead: `Discipline score: ${disciplineScore}/100. ${disciplineScore >= 80 ? 'Process is holding up well.' : 'There is room to tighten the workflow.'}`,
      riskRead: this.buildRiskRead(rules),
      eaOperationRead: this.buildEaOperationRead(context, rules),
      whatYouDidWell: positives,
      whatNeedsCorrection: corrections,
      teaching: this.toneService.buildTeachingParagraph({
        studentName: context.student.username,
        riskLevel: rules.riskLevel,
        positives,
        corrections,
        period,
      }),
      nextSessionRule:
        rules.suggestions[0] ||
        'Come in with the plan on paper and keep your hands calm.',
      coachFlag: rules.coachFlag,
    };
  }

  createQuickReadEmbed(analysis) {
    return new EmbedBuilder()
      .setTitle('\u{1F9D9}\u{1F3FE}\u200D\u2642\uFE0F WISDO READ')
      .setColor(this.getColorForRisk(analysis.rules.riskLevel))
      .setDescription(
        [
          `**Student:** ${analysis.context.student.mention}`,
          `**Date:** ${getDateLabel()}`,
          `**Mode:** ${analysis.mode}`,
          '**Data Used:**',
          ...analysis.dataUsed.map((item) => `- ${item}`),
          '',
          `**Current Read:** ${analysis.currentRead}`,
          '',
          `**Risk Level:** ${analysis.rules.riskLevel}`,
          `**WISDO Suggestions:**\n${buildNumberedList(analysis.rules.suggestions)}`,
          '',
          `**Student Lesson:** ${analysis.studentLesson}`,
          `**Coach Flag:** ${analysis.rules.coachFlag}`,
          '',
          `**Note:** ${analysis.note}`,
        ].join('\n'),
      )
      .setTimestamp(new Date());
  }

  createReviewEmbed(review) {
    return new EmbedBuilder()
      .setTitle('\u{1F4D8} WISDO REVIEW')
      .setColor(this.getColorForRisk(review.rules.riskLevel))
      .setDescription(
        [
          `**Student:** ${review.context.student.mention}`,
          `**Period:** ${getPeriodLabel(review.period, review.context.week.range)}`,
          `**Logs Reviewed:** ${review.logsReviewed}`,
          '',
          `**Performance Read:** ${review.performanceRead}`,
          `**Discipline Read:** ${review.disciplineRead}`,
          `**Risk Read:** ${review.riskRead}`,
          `**EA Operation Read:** ${review.eaOperationRead}`,
          '',
          `**What You Did Well:**\n${buildNumberedList(review.whatYouDidWell)}`,
          '',
          `**What Needs Correction:**\n${buildNumberedList(review.whatNeedsCorrection)}`,
          '',
          `**WISDO Teaching:** ${review.teaching}`,
          '',
          `**Next Session Rule:** ${review.nextSessionRule}`,
          `**Coach Flag:** ${review.coachFlag}`,
        ].join('\n'),
      )
      .setTimestamp(new Date());
  }

  getColorForRisk(riskLevel) {
    switch (riskLevel) {
      case 'Critical':
        return 0xe74c3c;
      case 'High':
        return 0xe67e22;
      case 'Medium':
        return 0xf1c40f;
      default:
        return 0x2ecc71;
    }
  }

  shouldAutoAnalyze(trigger) {
    if (!this.isEnabled()) {
      return false;
    }

    const mapping = {
      'clock-in': this.config.wisdo.autoAnalyzeClockIn,
      'ea-log': this.config.wisdo.autoAnalyzeEaLog,
      'clock-out': this.config.wisdo.autoAnalyzeClockOut,
      'weekly-review': this.config.wisdo.autoAnalyzeWeeklyReview,
    };

    return Boolean(mapping[trigger]);
  }

  async maybePostAutoAnalysis({ guild, channel, discordUserId, trigger }) {
    if (!this.shouldAutoAnalyze(trigger)) {
      return null;
    }

    try {
      const analysis = await this.analyzeCurrentDesk(guild, discordUserId);
      const content = this.toneService.buildAutoReply({
        trigger,
        riskLevel: analysis.rules.riskLevel,
        topFinding: analysis.rules.topFinding,
        studentName: analysis.context.student.username,
        suggestions: analysis.rules.suggestions,
        coachFlag: analysis.rules.coachFlag,
      });

      return await channel.send({ content });
    } catch (error) {
      logger.warn('WISDO auto-analysis failed', {
        discordUserId,
        trigger,
        message: error.message,
      });
      return null;
    }
  }
}
