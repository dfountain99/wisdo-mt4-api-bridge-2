import { randomUUID } from 'node:crypto';

const MODES = Object.freeze({
  coach: { label: 'Coach', outputs: ['action plan', 'private reflection', 'follow-up'] },
  instructor: { label: 'Instructor', outputs: ['lesson', 'quiz', 'progress update'] },
  meeting: { label: 'Meeting Brain', outputs: ['summary', 'decisions', 'assignments'] },
  trading: { label: 'Trading Copilot', outputs: ['analysis', 'draft action', 'verified receipt'] },
  screen: { label: 'Screen Guide', outputs: ['procedure', 'chapters', 'automation proposal'] },
  creator: { label: 'Creator Studio', outputs: ['course', 'content', 'campaign draft'] },
  host: { label: 'Community Host', outputs: ['agenda', 'speaking queue', 'community recap'] },
  focus: { label: 'Focus Guardian', outputs: ['focus cycle', 'break prompt', 'accountability check'] },
  moderator: { label: 'Moderator', outputs: ['queue', 'de-escalation prompt', 'moderator alert'] },
  observer: { label: 'Silent Observer', outputs: ['notes', 'questions', 'recap'] },
});

const CAPABILITIES = Object.freeze([
  'consent-led voice sessions', 'wake-word coaching', 'live lesson support', 'meeting intelligence',
  'voice-to-course generation', 'curriculum and assessment design', 'Discord channel placement',
  'screen-share companion handoff', 'procedure capture', 'accessibility and translation',
  'event and office-hour planning', 'promotion drafts and approval', 'learner progress',
  'source provenance', 'authority-scoped trading drafts', 'completion receipts',
]);

function clean(value, max = 500) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.slice(0, max);
}

function slug(value, fallback = 'course') {
  return clean(value, 90).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || fallback;
}

function sentence(value) {
  const text = clean(value, 600);
  return text ? text[0].toUpperCase() + text.slice(1) : '';
}

export class WisdoPresenceLearningService {
  constructor({ repository = null, logger = console } = {}) {
    this.repository = repository;
    this.logger = logger;
    this.sessions = new Map();
    this.drafts = new Map();
  }

  manifest() {
    return {
      version: '1.0.0', modes: MODES, capabilities: CAPABILITIES,
      screenShare: { nativeDiscordStreamAccess: false, requiresExplicitCompanionShare: true },
      recording: { default: false, unanimousConsentRequired: true, visibleIndicatorRequired: true },
      financialExecution: { default: 'draft_only', confirmationRequired: true, receiptRequired: true },
    };
  }

  startSession({ guildId, channelId, ownerId, mode = 'coach', participants = [], consent = {} } = {}) {
    if (!MODES[mode]) throw new Error(`Unknown WISDO presence mode: ${mode}`);
    const recording = Boolean(consent.recording);
    const consented = new Set(consent.participantIds || []);
    if (recording && participants.some((id) => !consented.has(id))) {
      throw Object.assign(new Error('Every participant must consent before recording or transcription begins.'), { code: 'consent_required' });
    }
    const session = {
      sessionId: randomUUID(), guildId: clean(guildId, 100), channelId: clean(channelId, 100),
      ownerId: clean(ownerId, 100), mode, status: 'active', participants: [...new Set(participants.map(String))],
      consent: { recording, participantIds: [...consented], screenShare: Boolean(consent.screenShare) },
      startedAt: new Date().toISOString(), outputs: MODES[mode].outputs,
    };
    this.sessions.set(session.sessionId, session);
    return session;
  }

  createCourseDraft({ ownerId, guildId, title, outcome, audience, source = 'voice conversation', duration = 'self-paced' } = {}) {
    const safeTitle = sentence(title) || 'New WISDO Course';
    const safeOutcome = sentence(outcome) || `Apply the foundations of ${safeTitle}`;
    const safeAudience = clean(audience, 160) || 'CEM Culture members';
    const id = randomUUID();
    const courseSlug = slug(safeTitle);
    const modules = [
      { number: 1, title: 'Orientation and Outcome', objective: `Define success for ${safeOutcome}.` },
      { number: 2, title: 'Foundations and Vocabulary', objective: `Build the essential language and mental model for ${safeTitle}.` },
      { number: 3, title: 'Guided Demonstration', objective: 'Watch the complete process with decisions explained.' },
      { number: 4, title: 'Practice Lab', objective: 'Apply the process in a controlled scenario with coaching.' },
      { number: 5, title: 'Assessment and Reflection', objective: 'Demonstrate understanding and identify the next weakness.' },
      { number: 6, title: 'Graduation Challenge', objective: `Complete an independent outcome aligned with: ${safeOutcome}.` },
    ];
    const draft = {
      courseId: id, ownerId: clean(ownerId, 100), guildId: clean(guildId, 100), slug: courseSlug,
      title: safeTitle, outcome: safeOutcome, audience: safeAudience, source: clean(source, 300), duration: clean(duration, 80),
      status: 'draft', modules,
      channels: [
        ['course-announcements', 'Official course transmissions and schedule changes.'],
        ['start-here', `Orientation, outcome, and instructions for ${safeTitle}.`],
        ['curriculum', 'Modules, objectives, completion requirements, and source notes.'],
        ...modules.map((module) => [`lesson-${String(module.number).padStart(2, '0')}-${slug(module.title, 'module')}`, module.objective]),
        ['practice-lab', 'Exercises, demonstrations, submissions, and feedback.'],
        ['ask-wisdo', 'Course-grounded questions and coaching.'],
        ['student-wins', 'Approved learner milestones and meaningful progress.'],
        ['progress-dashboard', 'Completion, assessments, and next recommended lesson.'],
      ],
      voiceChannels: ['live-classroom', 'office-hours'],
      promotion: {
        status: 'approval_required',
        headline: `${safeTitle} — enrollment opening`,
        announcement: `Learn to ${safeOutcome.toLowerCase()} through guided instruction, practice, and a graduation challenge. Built for ${safeAudience}.`,
        sequence: ['launch announcement', '24-hour reminder', 'class starting', 'approved learner highlight', 'completion recap'],
      },
      governance: { publishRequiresStaff: true, promotionRequiresApproval: true, sourcesRetained: true },
      createdAt: new Date().toISOString(),
    };
    this.drafts.set(id, draft);
    return draft;
  }

  screenCompanionContract({ ownerId, windowLabel, purposes = [] } = {}) {
    return {
      shareId: randomUUID(), ownerId: clean(ownerId, 100), windowLabel: clean(windowLabel, 160) || 'User-selected window',
      state: 'awaiting_explicit_share', nativeDiscordCapture: false,
      purposes: purposes.length ? purposes.map((item) => clean(item, 100)) : ['coach', 'document procedure'],
      prohibited: ['background capture', 'credential storage', 'unannounced recording'],
      controls: ['pause vision', 'hide region', 'discard capture', 'stop sharing'],
    };
  }

  async persist(record) {
    if (!this.repository?.addLog) return record;
    await this.repository.addLog(record);
    return record;
  }
}

export { MODES as WISDO_PRESENCE_MODES, CAPABILITIES as WISDO_PRESENCE_CAPABILITIES };
