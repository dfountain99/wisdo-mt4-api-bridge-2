# WISDO Presence, Learning, and Community OS

## Purpose

WISDO is an authorized intelligence layer for CEM Culture. Discord is the gathering surface; WISDO turns approved conversation and activity into guidance, durable knowledge, courses, community operations, and verified actions.

This system extends the existing Neural Command Network, Operator Capsules, WISDO Coach, Academy, MT4 authority, Digital Twin, memory, plans, device mesh, and event fabric. It does not replace their safety boundaries.

## Universal flow

Every capability follows the same lifecycle:

1. **Event** — a person speaks, presses a control, shares an approved source, enters a room, or a connected system emits telemetry.
2. **Consent** — WISDO resolves who may be heard, transcribed, viewed, remembered, mentioned, or acted for.
3. **Context** — identity, room purpose, goal, course, account, permissions, and prior approved memory are resolved.
4. **Understanding** — WISDO separates questions, ideas, decisions, commitments, teaching material, and requested actions.
5. **Plan** — WISDO creates a preview containing outputs, placement, authority requirements, and rollback.
6. **Approval** — publishing, promotion, permissions, and financial actions pass their own authority gates.
7. **Execution** — registered capabilities perform narrowly scoped work.
8. **Verification** — requested, accepted, queued, executed, rejected, failed, and rolled back remain distinct states.
9. **Memory** — only approved artifacts and preferences enter durable memory with provenance and deletion controls.
10. **Learning** — measured outcomes improve recommendations without silently widening authority.

## Presence modes

| Mode | Live purpose | Durable outputs |
|---|---|---|
| Coach | Questions, reflection, accountability | Action plan, follow-up, private reflection |
| Instructor | Teach and assess | Lesson, quiz, progress update |
| Meeting Brain | Clarify collaboration | Summary, decisions, assignments |
| Trading Copilot | Explain, simulate, draft | Analysis, confirmed action, execution receipt |
| Screen Guide | Guide an explicitly shared surface | Procedure, chapters, automation proposal |
| Creator Studio | Convert expertise into assets | Course, content set, campaign draft |
| Community Host | Operate a healthy room | Agenda, speaking queue, recap |
| Focus Guardian | Protect attention | Focus cycle, break prompt, accountability check |
| Moderator | Assist authorized moderators | Queue, de-escalation prompt, moderator alert |
| Silent Observer | Avoid interrupting | Notes, questions, recap |

## Voice session lifecycle

`STANDBY → CONSENT → ACTIVE → PAUSED → PROCESSING → REVIEW → PUBLISHED → ARCHIVED`

- Listening and recording are separate permissions.
- Recording and transcription default to off.
- A visible indicator and unanimous participant consent are required for recording.
- `stop listening`, physical mute, session controls, or removal from the voice room terminate capture.
- Participants can inspect and correct attribution before publication.
- Private coaching does not become community content without explicit promotion approval.

## Screen Guide contract

A normal Discord bot is not treated as having access to another member's stream pixels. Visual assistance requires a deliberate WISDO companion share, selected-window capture, or user-provided screenshots.

Required controls:

- Pause vision
- Hide or blur a region
- Discard the current capture
- Stop sharing
- Exclude credentials and private notifications
- Choose whether approved frames may become course material

WISDO may guide, document a procedure, build chapters, compare against an approved template, and propose automation. It may not perform background capture, store credentials, or claim to have seen a surface it did not receive.

## Voice-to-Course Forge

Input can be a coached interview, consented voice session, instructor notes, approved screen demonstration, or existing Academy material. WISDO produces:

- Audience and measurable outcome
- Six-module initial curriculum
- Vocabulary and mental model
- Guided demonstration
- Practice lab
- Assessment and reflection
- Graduation challenge
- Source/provenance notes
- Instructor review points
- Discord category, lesson channels, classroom, and office hours
- Enrollment announcement and promotion sequence
- Progress and next-lesson model

The generated hierarchy is a draft until a Coach/Admin publishes it. Promotion remains separately approval-gated after course publication.

## Community intelligence

WISDO may welcome returning members, explain current room purpose, route questions, maintain a speaking queue, run polls, create breakout recommendations, identify unanswered questions, recognize meaningful progress, and build post-session continuity.

It must not optimize for compulsive engagement. Quality, learning, completed commitments, healthy participation, and member-controlled notification preferences outrank raw activity.

## Promotion engine

Promotion uses an explicit state machine:

`DRAFT → REVIEW → SCHEDULED → PUBLISHED → MEASURED → LEARNED`

It can prepare announcements, scheduled-event copy, audience-specific angles, countdowns, enrollment paths, instructor spotlights, approved learner wins, and follow-ups. It cannot mass-mention unconsented roles, bypass rate limits, or publish private coaching material.

## Trading boundary

Trading capability levels remain separate:

1. Explain
2. Simulate
3. Draft
4. Confirm
5. Execute inside explicit account, symbol, time, risk, and loss boundaries
6. Verify through Reporter/MT4 completion receipt

Queued is never reported as executed. Voice authority never bypasses demo/live restrictions, ownership, confirmation, emergency stop, risk policy, or receipt verification.

## Capability families carried into the master design

- Universal event fabric and registered capability system
- Identity, pairing, Digital Twin, and cross-device presence
- Goals, plans, commitments, schedules, and persistent timers
- Decision, hypothesis, research, simulation, and counterfactual engines
- Course generation, tutoring, assessment, certification, and expert routing
- Memory graph, provenance, knowledge compiler, and culture constitution
- Agent council, workflow recording, skill proposals, and bounded self-repair
- Discord room operations, onboarding, hosting, moderation, and recognition
- Creator Studio, content transformation, event planning, and promotion
- Website, desktop, browser, Raspberry Pi, mobile, and notification mesh
- Account-aware MT4 analysis and authority-scoped execution
- Privacy, consent, audit, rollback, governance, and emergency controls
- Offline/edge operation and distributed presence
- Accessibility, captions, translation, pacing, and simplified explanations
- Future-self planning, organizational memory, and member-controlled legacy

## Current implementation boundary

Implemented in this release:

- Neural Command Deck entry controls for Presence, Course Forge, and Screen Guide
- Ten-mode presence manifest and consent validation
- Course-draft generation with curriculum, placement, governance, and promotion plan
- Coach/Admin channel publication into a dedicated Academy category
- Live classroom and office-hours voice room creation
- Creator Studio, promotion review, and session recap surfaces
- Explicit screen companion contract
- Unit and Discord contract tests

Requires a later connected-runtime release:

- Discord voice transport adapter and live speech turn-taking
- Companion desktop/browser screen transport
- Durable PostgreSQL course/session repositories (draft logs exist now)
- Course-grounded live retrieval and automatic assessment persistence
- Scheduled Discord event publishing and promotion measurement
- Cross-device captions, translation, and synchronized visual Activity

