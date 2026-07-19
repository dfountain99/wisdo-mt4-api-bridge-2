Below is a **full website upgrade patch** you can send into your trading ecosystem build.

---

# CULTURECOIN / WISDO WEBSITE UPGRADE PATCH

## Patch Name

**CultureCoin Social Copy Trading Ecosystem Upgrade**

## Main Goal

Upgrade the website from a basic trading dashboard into a full **social trading platform** with a TikTok-style experience that unlocks only after the user is connected.

The platform should support:

* Public marketing website
* Connected-user social trading app
* TikTok-style trading feed
* Copy Trading Hub
* Bot Marketplace
* WISDO Control Center
* Telegram long-video student review system
* Discord member desk integration
* MT4 account linking
* Growth/risk/harvest gauges
* Trader ranking system
* Admin control panel

---

# 1. Website State Logic

The website must change based on the user’s connection state.

## User States

### State 1: Public Visitor

User is not logged in.

Show public website only.

Public pages:

* Home
* Bot Store Preview
* Pricing
* Education
* Public Results
* Risk Disclosure
* Login / Join
* Connect MT4 CTA

Public users cannot access:

* Culture Feed
* Copy Hub
* WISDO Commands
* Live Account Dashboard
* Private Signals
* Discord Desk
* Student Review Room
* Copy Execution

---

### State 2: Logged In but Not Connected

User has an account but has not connected MT4, Discord, or Telegram.

Show onboarding mode.

Onboarding pages:

* Generate pairing code
* Download MT4 Reporter
* Enable MT4 WebRequest instructions
* Connect Discord
* Connect Telegram
* Choose account visibility
* Locked previews of Feed, Copy Hub, WISDO, and Reviews

User can:

* Buy bots
* Browse education
* Join membership
* View public previews

User cannot:

* Copy traders
* Send WISDO account commands
* Access live feed
* Submit trading video for account-matched review
* Post live trade results

---

### State 3: Connected User

User has at least one connected MT4 account, Discord desk, or approved student profile.

Unlock full trading social app.

Connected app navigation:

```txt
Feed | Copy | Bots | Live | Profile
```

Floating button:

```txt
Ask WISDO
```

Connected users can:

* View Culture Feed
* Copy traders/signals
* Buy and install bots
* Submit videos for review
* Use WISDO account commands
* View live account tracker
* Join private desk
* View rankings
* See gauges and live KPIs

---

## Required App Gate Logic

```js
const isLoggedIn = !!user;
const hasConnectedAccount =
  user?.connectedAccounts?.length > 0 ||
  user?.discordDeskConnected === true ||
  user?.telegramConnected === true;

const isTradingAppUnlocked = isLoggedIn && hasConnectedAccount;

if (!isLoggedIn) {
  return <PublicWebsite />;
}

if (isLoggedIn && !hasConnectedAccount) {
  return <ConnectionOnboarding />;
}

if (isTradingAppUnlocked) {
  return <TradingSocialApp />;
}
```

---

# 2. Public Website Upgrade

## Public Home Page

The public home page should sell the ecosystem clearly.

Hero headline:

```txt
Scroll the market. Copy the move. Let WISDO protect your account.
```

Subheadline:

```txt
CultureCoin is a social copy trading platform built for bots, signals, live account tracking, and AI-powered trading coaching.
```

Main buttons:

```txt
Join CultureCoin
Connect MT4
Buy Bots
View Public Results
```

Sections:

1. Hero section
2. How it works
3. Bot marketplace preview
4. Public trader result previews
5. WISDO protection explanation
6. Student Film Room preview
7. Pricing
8. Risk disclosure

---

## Public Navigation

Before connection:

```txt
Home | Bots | Pricing | Education | Results | Login
```

After connection:

```txt
Feed | Copy | Bots | Live | Profile
```

---

# 3. Connected Social Trading App

## Main Concept

After a user connects, the website should feel like **TikTok for traders**.

The user scrolls through full-screen trading posts. Every post can lead to:

* Copy trader
* Copy signal
* Buy bot
* View account
* Ask WISDO
* Join desk
* Submit review
* Follow trader

---

# 4. Culture Feed

## Feed Layout

Vertical full-screen feed.

Each feed item can be:

* Video post
* Chart post
* Bot performance post
* Signal alert
* Win recap
* Education clip
* WISDO review clip
* Trader live replay

---

## Feed Card Design

Each feed post should show:

Left/bottom content:

* Trader username
* Caption
* Bot used
* Symbol
* Account type: Demo / Live
* Current growth %
* Risk level
* WISDO note

Right-side action buttons:

```txt
Like
Comment
Share
Save
Stats
Bot
Copy
Ask WISDO
```

Bottom CTA buttons:

```txt
Copy Setup
View Bot
Join Desk
Follow Trader
```

---

## Feed Filters

Tabs:

```txt
For You
Following
Live Now
Top Growth
Low Drawdown
Gold Only
Bot Battles
Education
Student Reviews
```

---

## Feed Algorithm Rules

Recommend posts based on:

* User’s watched traders
* User’s copied traders
* User’s favorite bots
* Account size
* Risk preference
* Symbol preference
* XAUUSD interest
* Previous likes/saves
* WISDO safety score
* Connected account behavior

---

# 5. Copy Trading Hub

## Copy Hub Purpose

The Copy Hub lists all current running EAs, traders, and connected accounts that are approved for copying.

## Copy Hub Cards

Each card should show:

* Trader name
* Account type: Demo / Live
* EA name
* Account balance
* Account equity
* Daily growth %
* Weekly growth %
* Monthly growth %
* Total growth %
* Floating P/L
* Closed P/L
* Drawdown %
* Open trades
* Win rate
* Current rank
* Copy status
* WISDO safety status

Buttons:

```txt
Copy Trader
Copy Bot
Copy Signal Only
View History
Join Desk
Ask WISDO
```

---

## Copy Settings

When user clicks copy:

Options:

```txt
Copy trader
Copy bot only
Copy signals only
Copy XAUUSD only
Copy by account ratio
Copy by fixed lot
Copy by risk percentage
Copy only after trader grows 100%
Copy only if drawdown is under X%
Stop copying if drawdown hits X%
Max daily loss
Max open trades
Max lot size
Pause during news
Use WISDO protection
```

---

## Copy After Proof Rule

A trader can be locked until they prove performance.

Unlock rules:

```txt
Unlock copy after +50% growth
Unlock copy after +100% growth
Unlock copy after 3 profitable days
Unlock copy after WISDO safety check
Unlock copy after admin approval
```

---

# 6. Gauge System

Add gauge charts everywhere.

These are also called:

```txt
Gauge charts
Speedometer gauges
Radial progress meters
KPI gauges
```

## Required Gauges

### Growth Gauge

Tracks account growth.

Levels:

```txt
0% Starter
25% Builder
50% Momentum
100% Doubled
250% Power
500% Beast Mode
1000% Quantum
```

---

### Risk Gauge

Tracks risk level.

Levels:

```txt
Safe
Moderate
Aggressive
High Risk
Danger
Lockdown
```

---

### Harvest Gauge

Tracks secured profit.

Metrics:

```txt
Floating profit
Locked profit
Withdrawn profit
Reinvested profit
Harvest target
Harvest percentage
```

---

### Rank Gauge

Tracks progress to next rank.

Ranks:

```txt
New Operator
Bronze Trader
Silver Builder
Gold Operator
Platinum Commander
Diamond Strategist
Legend Trader
Quantum Operator
Covenant Rank
```

---

### KPI Gauge

Tracks account health.

Metrics:

```txt
Daily goal progress
Weekly goal progress
Drawdown control
Consistency score
Win streak
Account freshness
Bot activity
```

---

# 7. Bot Marketplace

## Bot Store Purpose

Users must be able to buy bots directly from the website.

## Bot Store Card

Each bot card should show:

* Bot name
* Bot image/video
* Best market
* Strategy type
* Risk level
* Suggested account size
* Monthly price
* Lifetime price
* Demo results
* Live results
* Supported platforms: MT4 / MT5
* Version
* Last updated
* WISDO compatibility
* Checkout button

Buttons:

```txt
Buy Bot
View Results
Copy Live Account Running This Bot
Add to WISDO
Install Guide
```

---

## Recommended Bot Highlight

Mark preferred bot:

```txt
Recommended Today: DF SAUCE FINAL AI
```

Badge:

```txt
WISDO Recommended
```

---

## Bot Detail Page

Each bot should have:

* Overview
* Strategy explanation
* Screenshots
* Performance chart
* Risk notes
* Setup instructions
* Compatible commands
* User reviews
* Checkout
* Download after purchase

---

# 8. Checkout System

Add checkout support for:

* Bot purchases
* Memberships
* Video review credits
* Priority coaching
* VPS/device products
* Signal memberships

Payment options:

```txt
Stripe
PayPal
Manual invoice
Admin comp access
Coupon codes
Affiliate/seller link
```

---

## Product Types

```js
{
  type: "bot" | "membership" | "video_review" | "coaching" | "vps" | "device" | "signal_access",
  name,
  priceMonthly,
  priceLifetime,
  minimumResalePrice,
  maximumSuggestedPrice,
  commissionRate,
  active
}
```

---

# 9. WISDO Control Center

## Purpose

WISDO should let users control their connected trading account from the website.

## Control Buttons

```txt
Pause Bot
Resume Bot
Close Profits
Close All
Cut Losses
Harvest 25%
Harvest 50%
Harvest 100%
Buy Only
Sell Only
Allow Hedge
Block Hedge
Reduce Risk
Increase Risk
Protect My Account
Stop Trading Today
Allow Another Anchor
Limit Ladder Entries
Set Max Drawdown
Set Daily Goal
```

---

## WISDO Command Box

User can type natural language:

```txt
Tell WISDO what to do...
```

Examples:

```txt
Protect my account while I’m away.
Take 50% of profits when equity grows 100%.
Allow sells only.
Close all trades if drawdown hits 30%.
Limit this account to 5 ladder entries.
Do not trade during news.
Copy DF Sauce at 0.25 risk.
```

---

## WISDO Command Record

Each command should store:

```js
{
  commandId,
  userId,
  accountId,
  rawText,
  parsedIntent,
  parameters,
  status: "queued" | "sent" | "received" | "applied" | "failed",
  createdAt,
  appliedAt
}
```

---

# 10. MT4 Account Linking

## Connect Account Page

Steps:

1. Generate pairing code
2. Download CultureCoin MT4 Reporter
3. Install Reporter in MetaTrader
4. Enable WebRequest
5. Paste pairing code
6. Test connection
7. Choose visibility
8. Choose copy permission

---

## Account Visibility Options

```txt
Private
Show stats only
Show in Copy Hub
Allow copy after approval
Allow copy after 100% growth
Allow signal-only followers
```

---

## Multiple Account Support

A user can connect:

* Demo account
* Live account
* Multiple MT4 accounts
* Multiple brokers
* Multiple bots
* Multiple symbols

Account switcher required:

```txt
Active Account: 5220807 - Coinexx Demo
```

Buttons:

```txt
Switch Account
Disconnect Account
Set as Primary
Hide from Copy Hub
```

---

# 11. Discord Member Desk Integration

## Member Desk Features

Connected user should have a private Discord desk.

Desk should receive:

* MT4 status updates
* Signals
* WISDO commands
* Bot alerts
* Copy trading events
* Video review notifications
* Coaching notes
* Growth milestones

---

## Signal Rule

Signals only post in the member desk running the bot unless public sharing is approved.

Rule:

```txt
Signals post privately by default.
Public visibility requires account owner approval or admin approval.
```

---

# 12. Telegram Long Video Review System

## Feature Name

```txt
WISDO Film Room
```

## Purpose

Students can send long videos from Telegram, such as 36-minute trade review videos, and the system creates a coaching review ticket.

---

## Supported Submission Sources

```txt
Telegram
Website upload
Discord desk
Google Drive link
YouTube unlisted link
Loom link
Dropbox link
```

---

## Telegram Bot Flow

Student sends video to:

```txt
@WisdoCoachBot
```

Bot replies:

```txt
Video received. WISDO is preparing your review.
```

If file is too large:

```txt
Your video is large. Send a Google Drive, Loom, Dropbox, or YouTube unlisted link so WISDO can review it.
```

---

## Review Ticket Data

```js
{
  reviewId,
  studentId,
  coachId,
  source: "telegram" | "website" | "discord" | "drive" | "youtube" | "loom",
  sourceMessageId,
  videoUrl,
  originalFileName,
  durationSeconds,
  fileSize,
  status: "uploaded" | "processing" | "transcribed" | "needs_review" | "reviewed" | "sent" | "archived",
  transcriptUrl,
  wisdoSummary,
  timestampNotes,
  linkedAccountId,
  linkedTrades,
  createdAt,
  updatedAt
}
```

---

## Video Processing Pipeline

When a student submits a video:

1. Receive video or link
2. Store video in Cloudflare R2 / AWS S3
3. Extract audio
4. Transcribe audio
5. Split transcript by timestamps
6. Detect trading terms
7. Detect bot names
8. Detect symbol names
9. Match with MT4 trade history if account is connected
10. Generate WISDO summary
11. Create review ticket
12. Notify coach
13. Let coach add timestamp comments
14. Send review back to student

---

## WISDO Film Room Coach Dashboard

Create tab:

```txt
Review Queue
```

Columns:

```txt
Student
Video Length
Source
Bot Used
Account Connected
Status
Priority
Submitted Date
Coach Assigned
Review Button
```

Statuses:

```txt
Uploaded
Processing
Needs Coach Review
Reviewed by WISDO
Coach Responded
Sent Back to Student
Archived
```

---

## Video Review Page

Layout:

### Left Side

* Video player
* Playback speed
* Timestamp markers
* Screenshot capture
* Add timestamp note

### Right Side

* Transcript
* WISDO summary
* Detected issues
* Linked MT4 trades
* Student stats
* Coach notes
* Response builder

### Bottom

* Timeline comments
* Assignments
* Recommended commands
* Send response button

---

## Timestamp Comment Example

```txt
12:42 — You enabled the bot too early. Wait for confirmation candle close before allowing entries.

18:09 — This is where WISDO should have paused new ladders.

24:33 — This was a harvest moment. You were in profit and should have secured partial gains.
```

---

## WISDO Review Output Template

```txt
Main Issue:
Student entered before confirmation and allowed the bot to ladder without protection.

What Went Right:
Student identified the correct direction and used the correct EA.

What Went Wrong:
Entry was early. Risk guard was not set. Profit was not harvested when available.

Correction:
Wait for BOS confirmation, check D1 direction, and enable WISDO protection mode.

Recommended WISDO Command:
Protect my account and limit ladder entries to 5 until the account grows 100%.

Coach Assignment:
Submit another video showing only the entry confirmation process.
```

---

# 13. Student Review Pricing

Add monetization for video reviews.

```txt
Free Member:
1 short video review per month
Max 5 minutes

Culture Member:
2 reviews per month
Max 15 minutes

Operator:
4 reviews per month
Max 45 minutes

Commander:
Priority reviews
Long-form videos
Coach response
WISDO + Derrion review
```

Add products:

```txt
Extra Review: $25
Priority Review: $75
Live Coaching Call: $150
```

---

# 14. Trader Profiles

Each trader profile should feel like TikTok/Instagram.

## Profile Header

Show:

* Username
* Profile photo
* Rank
* Verified badge
* Demo/live badge
* Main EA
* Followers
* Copiers
* Total growth
* Harvested profit
* Max drawdown
* WISDO safety score

Buttons:

```txt
Follow
Copy Trader
Message
Join Desk
View Bots
```

Tabs:

```txt
Videos
Live Trades
Results
Bots
Signals
Reviews
```

---

# 15. Live Trading Rooms

Create TikTok Live-style trading rooms.

## Culture Live Features

Streamer can show:

* Chart
* MT4 dashboard
* Bot dashboard
* WISDO alerts
* Account growth
* Current trade status

Viewers can:

* Comment
* Like
* Follow
* Copy trader
* Buy bot
* Join desk
* Ask WISDO
* Save replay

---

# 16. Admin Panel

Admin needs full control.

## Admin Pages

```txt
Dashboard
Users
Connected Accounts
Copy Hub Approvals
Bot Store
Orders
Subscriptions
Telegram Reviews
Discord Desks
Signals
WISDO Commands
Risk Alerts
Content Moderation
Settings
```

---

## Admin Functions

Admin can:

* Approve trader for Copy Hub
* Remove unsafe account
* Verify demo/live status
* Add/edit bots
* Set bot prices
* View linked accounts
* View account growth
* View command logs
* View failed MT4 connections
* Manage Discord desks
* Manage Telegram review tickets
* Assign coach
* Send coaching response
* Refund/cancel orders
* Grant free access
* Ban/suspend user
* Feature a trader
* Feature a bot

---

# 17. Database Models

## User

```js
{
  id,
  username,
  email,
  phone,
  profileImage,
  role: "visitor" | "member" | "operator" | "coach" | "admin",
  membershipTier,
  discordId,
  telegramId,
  createdAt,
  updatedAt
}
```

---

## ConnectedAccount

```js
{
  id,
  userId,
  accountNumber,
  broker,
  server,
  platform: "MT4" | "MT5",
  accountType: "demo" | "live",
  balance,
  equity,
  floatingPL,
  closedPLDaily,
  margin,
  freeMargin,
  marginLevel,
  openTrades,
  buyTrades,
  sellTrades,
  totalLots,
  symbols,
  activeEA,
  eaVersion,
  lastSyncAt,
  isConnected,
  isPrimary,
  visibility,
  copyPermission,
  createdAt,
  updatedAt
}
```

---

## Bot

```js
{
  id,
  name,
  slug,
  description,
  version,
  platform,
  bestMarket,
  riskLevel,
  suggestedAccountSize,
  monthlyPrice,
  lifetimePrice,
  downloadUrl,
  imageUrl,
  videoUrl,
  isRecommended,
  isWisdoCompatible,
  active,
  createdAt,
  updatedAt
}
```

---

## FeedPost

```js
{
  id,
  userId,
  accountId,
  botId,
  type: "video" | "chart" | "signal" | "win_recap" | "education" | "review",
  caption,
  mediaUrl,
  thumbnailUrl,
  symbol,
  direction,
  growthPercent,
  riskLevel,
  harvestPercent,
  rank,
  visibility: "public" | "members" | "private",
  likes,
  comments,
  shares,
  saves,
  createdAt
}
```

---

## CopyRelationship

```js
{
  id,
  copierUserId,
  sourceTraderId,
  sourceAccountId,
  mode: "trader" | "bot" | "signal_only",
  riskMultiplier,
  fixedLot,
  maxDailyLoss,
  maxDrawdown,
  maxOpenTrades,
  copyGoldOnly,
  copyAfterGrowthPercent,
  useWisdoProtection,
  status: "active" | "paused" | "stopped",
  createdAt,
  updatedAt
}
```

---

## WisdoCommand

```js
{
  id,
  userId,
  accountId,
  rawCommand,
  intent,
  parameters,
  status: "queued" | "sent" | "received" | "applied" | "failed",
  resultMessage,
  createdAt,
  appliedAt
}
```

---

## VideoReview

```js
{
  id,
  studentId,
  coachId,
  source,
  videoUrl,
  durationSeconds,
  transcript,
  wisdoSummary,
  timestampNotes,
  linkedAccountId,
  linkedTradeIds,
  status,
  priority,
  createdAt,
  updatedAt
}
```

---

## Order

```js
{
  id,
  userId,
  productType,
  productId,
  amount,
  paymentProvider,
  paymentStatus,
  accessGranted,
  createdAt
}
```

---

# 18. API Routes

## Auth / User

```txt
GET /api/me
POST /api/login
POST /api/logout
PATCH /api/profile
```

---

## Account Linking

```txt
POST /api/mt4/pairing-code
POST /api/mt4/sync
GET /api/accounts
GET /api/accounts/:id
PATCH /api/accounts/:id
POST /api/accounts/:id/disconnect
```

---

## Feed

```txt
GET /api/feed
POST /api/feed
GET /api/feed/:id
POST /api/feed/:id/like
POST /api/feed/:id/save
POST /api/feed/:id/share
POST /api/feed/:id/comment
```

---

## Copy Trading

```txt
GET /api/copy-hub
POST /api/copy/start
POST /api/copy/pause
POST /api/copy/stop
PATCH /api/copy/:id/settings
```

---

## Bots

```txt
GET /api/bots
GET /api/bots/:slug
POST /api/admin/bots
PATCH /api/admin/bots/:id
POST /api/bots/:id/purchase
```

---

## WISDO

```txt
POST /api/wisdo/command
GET /api/wisdo/commands
GET /api/wisdo/commands/:id
POST /api/wisdo/protect
POST /api/wisdo/harvest
```

---

## Video Reviews

```txt
POST /api/reviews/upload
POST /api/reviews/telegram-webhook
GET /api/reviews
GET /api/reviews/:id
PATCH /api/reviews/:id
POST /api/reviews/:id/timestamp-note
POST /api/reviews/:id/send-response
```

---

## Admin

```txt
GET /api/admin/dashboard
GET /api/admin/users
GET /api/admin/accounts
GET /api/admin/reviews
PATCH /api/admin/reviews/:id/assign
PATCH /api/admin/copy-hub/:accountId/approve
PATCH /api/admin/copy-hub/:accountId/remove
```

---

# 19. UI Components To Build

```txt
PublicHome
ConnectionOnboarding
TradingSocialApp
CultureFeed
FeedPostCard
CopyHub
CopyTraderCard
GaugeCluster
GrowthGauge
RiskGauge
HarvestGauge
RankGauge
BotMarketplace
BotCard
BotDetailPage
WisdoControlCenter
WisdoCommandBox
LiveAccountDashboard
TraderProfile
CultureLiveRoom
FilmRoom
ReviewQueue
VideoReviewPage
AdminDashboard
CheckoutPage
RiskDisclosureModal
```

---

# 20. Design Style

The site should feel like:

```txt
TikTok + Robinhood + Discord + TradingView + AI coach
```

Visual style:

* Dark theme first
* Neon green profit accents
* Red danger states
* Gold rank highlights
* Smooth vertical scrolling
* Full-screen feed cards
* Animated gauges
* Live account cards
* Floating WISDO button
* Mobile-first layout
* Desktop dashboard layout

---

# 21. Risk Disclaimer Requirement

Add disclaimer to public site, checkout, copy setup, and bot pages.

Text:

```txt
Trading involves risk. Past performance does not guarantee future results. Copy trading, bots, and signals can result in losses. Users are responsible for their own trading decisions, risk settings, and account management.
```

Before copying, require checkbox:

```txt
I understand that copy trading and bot trading involve risk and I am responsible for my account.
```

---

# 22. Final Platform Loop

The upgraded ecosystem should create this loop:

```txt
User joins
User connects MT4 / Discord / Telegram
Website unlocks social trading app
User scrolls Culture Feed
User sees trader/bot performance
User follows or copies
WISDO protects account
Results become shareable posts
Students submit videos
WISDO reviews and coaches
Best clips become education posts
More users join and copy
```

---

# Final Build Summary

Build the website so it works like this:

```txt
No connection = public website.

Connected account = TikTok-style trading social app.

Every trader can post results.

Every bot can be bought.

Every account can be tracked.

Every signal can go to Discord.

Every student video can become a WISDO Film Room review.

Every copy action can be protected by WISDO.
```

Core slogan:

```txt
Watch trades. Copy winners. Let WISDO protect your account.
```
