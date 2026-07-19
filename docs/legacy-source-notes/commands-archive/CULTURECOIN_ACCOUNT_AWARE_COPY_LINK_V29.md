# CultureCoin Account-Aware Copy Link V29

This patch fixes the multi-account copy-link problem.

## What changed

- Same Discord user can own multiple MT4 accounts.
- Each MT4 terminal/account must have its own pairing code.
- Pairing codes now become locked to the specific account number after first sync.
- WISDO stores accounts by `accountId = accountNumber:brokerServer` instead of only by Discord user.
- Discord signal buttons no longer guess the latest account.
- If a user has multiple accounts, WISDO asks which follower account should take the trade.
- After the account is chosen, WISDO asks how to size the trade: Same Risk, My Risk, or Fixed 0.01.
- `/my-accounts` lists every account connected to the current desk/user.
- `/set-active-account` sets the default account for Discord commands.
- `/connect-mt4` now accepts optional account nickname and role.

## New Discord commands

```txt
/connect-mt4 name: Live Copier role: Follower
/my-accounts
/set-active-account account_id: 1234567:Coinexx-Demo
```

## Discord signal flow

```txt
User clicks Take This Trade
If one account exists: WISDO asks risk mode
If multiple accounts exist: WISDO asks which follower account
Then WISDO asks risk mode
Then WISDO queues the command only for that accountId/pairingCode
```

## MT4 polling flow

```txt
MT4 Reporter polls with PairingCode + AccountNumber
Server resolves PairingCode -> owner Discord ID + accountId
Server returns only commands for that exact accountId
Wrong account cannot receive the command
```

## Required setup

Every MT4 terminal needs a different pairing code:

```txt
Demo Leader 1 -> Pairing Code 1
Live Leader -> Pairing Code 2
Live Copier -> Pairing Code 3
Test Account -> Pairing Code 4
```

Do not reuse a pairing code on another MT4 account. That will trigger HTTP 409 account mismatch.
