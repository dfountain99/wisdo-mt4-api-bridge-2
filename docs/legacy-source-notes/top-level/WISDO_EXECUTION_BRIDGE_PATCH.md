# Wisdo Execution Bridge Patch

This patch fixes the issue where website buttons and Wisdo wake words said they were queued but did not create executable MT4 reporter commands.

## What changed

- Website buttons now queue MT4 reporter command names the reporter actually understands:
  - `close_profitable` -> `CLOSE_ALL_PROFITS`
  - `close_all` -> `CLOSE_ALL_TRADES`
  - `emergency_close` -> `EMERGENCY_CLOSE_ALL`
  - `pause_copier` -> `PAUSE_COPIER`
  - `resume_copier` -> `RESUME_COPIER`
- Wake-word text like `hey coach close all profitable trades` now maps to `CLOSE_ALL_PROFITS`.
- Discord `/copier close-profitable`, `/copier close-all`, `/copier emergency-close`, and `/wisdo-coach command:<text>` were added.
- The queue now supports immediate priority. MT4 still has to poll `/mt4-command-poll`, but urgent commands go to the front with short TTL.
- Website now polls `/api/command/status` for completion after a command is queued.
- `/mt4-command-complete` now creates a website notification and can post a Discord webhook notification with a win GIF.
- `div.chart` now has animated growth bars, sweep glow, and command-center aesthetics.

## Important MT4 setup

For fastest execution, compile and use the updated `CultureCoin_MT4_Reporter.mq4` v1.54.

Recommended inputs:

```txt
ExportEverySeconds = 3
CommandPollEverySeconds = 1
CommandsPerPollTick = 3
PollCommandsBeforeSnapshot = true
EnableProfitManagerExecution = true
ProfitOnlyManageWisdoTrades = false
ProfitRequireAutoTrading = true
```

MT4 cannot receive a server push instantly. The fastest safe path is 1-second polling from the reporter. The backend now queues immediately and the reporter should poll every second.

## Reporter note

The `.mq4` source was updated. The compiled `.ex4` included in the project is not recompiled here because MetaTrader's compiler is not available in this environment. Open the updated `.mq4` in MetaEditor and compile to create the matching `.ex4`.
