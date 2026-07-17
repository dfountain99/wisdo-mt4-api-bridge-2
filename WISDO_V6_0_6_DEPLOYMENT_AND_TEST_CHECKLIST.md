# WISDO v6.0.6 Deployment and Test Checklist

## 1. Required Render configuration

Production will not start without PostgreSQL.

```text
NODE_ENV=production
DATABASE_URL=<Render PostgreSQL internal URL>
WISDO_PERSISTENCE_MODE=postgres
WISDO_DB_SSL=true
SESSION_SECRET=<long random secret>
ENCRYPTION_KEY=<32+ random characters>
PUBLIC_BASE_URL=https://wisdo-mt4-api-bridge.onrender.com
```

Redis relay:

```text
REDIS_ENABLED=true
REDIS_URL=<Render Redis internal URL>
REDIS_PREFIX=wisdo
```

WISDO AI:

```text
OPENAI_API_KEY=<secret>
WISDO_AI_MODEL=gpt-5-mini
WISDO_BACKGROUND_WORKERS_ENABLED=true
WISDO_COACH_MIN_INTERVAL_MINUTES=15
WISDO_COACH_POLL_INTERVAL_SECONDS=60
WISDO_NOTIFICATION_RETRY_INTERVAL_SECONDS=300
```

Broker API:

```text
METAAPI_DEFAULT_REGION=new-york
WISDO_BROKER_SYNC_INTERVAL_SECONDS=60
CTRADER_CLIENT_ID=<registered cTrader app client ID>
CTRADER_CLIENT_SECRET=<secret>
CTRADER_REDIRECT_URI=https://wisdo-mt4-api-bridge.onrender.com/api/v2/broker-api/ctrader/callback
```

Optional outbound coach delivery:

```text
RESEND_API_KEY=
RESEND_FROM_EMAIL=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
DISCORD_TOKEN=
```

## 2. Install and validate locally

```cmd
cd /d "%USERPROFILE%\Downloads\wisdo-v606-git"
npm config set registry https://registry.npmjs.org/
npm ci --no-audit --no-fund
npm run check
```

Expected:

```text
58 tests
58 pass
0 fail
```

## 3. Database verification

After Render deploys, open:

```text
/api/public/health
/api/runtime-audit
/api/copier-infrastructure-health
```

Confirm:

- Version is `6.0.6`.
- Persistence is `postgres`.
- PostgreSQL is connected.
- Redis is connected or clearly marked degraded.
- No production startup warning says JSON/file fallback.

Redeploy once and confirm accounts, Culture Lanes, pairing data, Allowed Symbols, Harvest settings, AI messages, and Academy progress survive.

## 4. Reporter v1.58 installation

Compile `CultureCoin_MT4_Reporter.mq4` in MetaEditor, copy the resulting EX4 into each terminal, and attach one Reporter per account.

Confirm the chart shows `v1.58` and the recommended connection settings. Test:

1. Healthy sync shows `Connected`.
2. Temporarily disconnect the internet.
3. One failure does not immediately become permanent `Error`.
4. Reporter shows `Degraded` or `Retrying` and increases the retry interval.
5. Restore internet and confirm it returns to `Connected`.
6. Open and close a demo leader trade and verify receiver execution and close authority.

## 5. Broker API tests

### MetaApi

- Open `/app/accounts`.
- Enter a valid MetaApi token and provider account ID.
- Confirm balance, equity, margin, positions, and provider metadata populate.
- Wait for the background refresh interval and confirm `lastSyncAt` advances.
- Confirm the account is labeled monitoring/API and cannot be selected as an execution receiver.

### cTrader

- Confirm the cTrader application callback exactly matches `CTRADER_REDIRECT_URI`.
- Complete OAuth.
- Confirm authorized live/demo account identities appear.
- Do not expect receiver execution until a cTrader execution adapter is enabled.

### Broker webhook

- Create a signed bridge connection.
- Save the secret immediately.
- POST a test snapshot using the generated URL and secret.
- Confirm incorrect secrets are rejected.

## 6. WISDO Coach tests

- Open Lane Intelligence.
- Select a Culture Lane.
- Confirm the welcome message references actual combined lane values.
- Ask about drawdown, symbol contribution, execution delays, and recent history.
- Confirm the answer identifies observations versus education/suggestions.
- Enable one notification channel and severity threshold.
- Create a demo warning condition and verify one database outbox record and one delivery attempt.

## 7. Academy AI tests

- Open Academy and select a Culture Lane.
- Generate a lesson from the lane.
- Ask the tutor a follow-up question.
- Return to Lane Intelligence and confirm shared memory can reference the educational topic.
- Confirm proprietary source code or hidden strategy parameters are not exposed.

## 8. Launch restrictions

- Keep Broker API accounts monitor-only unless an audited execution adapter exists.
- Use demo accounts for Reporter and copier regression tests.
- Do not enable outbound SMS or Discord DM without explicit user opt-in.
- WISDO AI supplies educational decision support, not guaranteed outcomes or autonomous live-trade instructions.
