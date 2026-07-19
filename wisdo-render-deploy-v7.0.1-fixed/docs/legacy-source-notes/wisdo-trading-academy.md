# Wisdo Trading Academy

## Purpose

Wisdo Trading Academy teaches trading foundations, risk, copy-trading safety, Signal Grid usage, bot behavior, simulator practice, and bot-specific training before users copy or activate live automation.

The academy is educational only. Trading involves risk. Results are not guaranteed. Nothing in the academy is financial advice.

## Member Routes

- `/member/education` remains the bot education portal and links into the academy.
- `/member/academy` renders the full Wisdo Trading Academy dashboard.
- `/member/academy/:trackSlug` opens a selected academy track.
- `/member/academy/lesson/:lessonId` is reserved for lesson deep links.

## Tracks Seeded

Starter content is seeded as admin-editable records:

- Trading Basics
- Candlesticks
- Market Structure
- Liquidity and Smart Money
- Risk Management
- Copy Trading Safety
- Signal Grid Training
- Bot Training
- News Trading
- Trading Psychology
- DF Sauce Final AI Training
- PIP DRILL Training
- FLOW Training

Each track has at least five starter lessons. Risk Management, Copy Trading Safety, Signal Grid Training, and DF Sauce Final AI Training include quiz gates.

## Lesson Model

Academy lessons live in `academyLessonsById` and include:

- `lessonId`
- `trackId`
- `botSlug`
- `title`
- `level`
- `estimatedMinutes`
- `learningGoals`
- `explanation`
- `keyTerms`
- `example`
- `commonMistakes`
- `wisdoTip`
- `riskWarning`
- related simulator, Signal Grid, and bot links
- published/draft status

## Quiz Model

Academy quizzes live in `academyQuizzesById` and support placeholder multiple-choice, true/false, and safest-action questions. Submissions calculate score, pass/fail, and persist the latest attempt per user in `academyQuizAttemptsByUserId`.

Required starter quiz gates:

- Risk quiz before live copy
- Signal Grid quiz before copy basket
- Bot safety quiz before high-risk/bot subscription flows
- Copy trading quiz before copy bot subscription

## Progress Model

Progress is stored in:

- `academyProgressByUserId` for started/completed lessons
- `academyQuizAttemptsByUserId` for quiz scores
- `academyUnlocksByUserId` reserved for future unlock records

The API returns track-level progress percentages and required education status.

## Copy And Bot Gates

Live Signal Grid basket copy checks required academy completion. Paper copy remains available for practice.

Copy bot subscriptions check risk, copy safety, and DF Sauce/bot safety education. Admin/owner override is allowed only when `educationOverride` is provided and is recorded in the admin audit log.

## Admin Builder

Admin-ready controls and APIs were added for:

- Create track
- Create lesson
- Patch lesson
- Set level
- Set bot-specific education
- Publish/draft through lesson status fields
- Keep seed content admin editable

Current APIs:

- `GET /api/wisdo/admin/academy`
- `POST /api/wisdo/admin/academy/tracks`
- `POST /api/wisdo/admin/academy/lessons`
- `PATCH /api/wisdo/admin/academy/lessons/:lessonId`

## Known Limitations

- Lesson content is starter educational content, not a full long-form course script yet.
- The lesson deep-link HTML route currently uses the academy shell; API lesson detail is complete.
- Quiz UI is API-ready but not a polished full quiz-taking screen yet.
- Bot activation gates are implemented for Signal Grid live copy and bot subscriptions; future bot install/download activation paths should call the same gate helper.
- Admin builder is functional but intentionally minimal.

## Next Upgrades

- Add full lesson reading pages with direct lesson URLs.
- Add a polished quiz runner UI with retake and answer review.
- Add admin lesson reorder UI.
- Add per-bot required education configuration.
- Add badges/certificates when required tracks are complete.
