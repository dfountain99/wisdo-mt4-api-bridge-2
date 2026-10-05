# WISDO Smart Control v1.52 — MT4-compatible dual-feed install and test

## What this package changes

- Preserves the Hightower v1.40 entry, risk, trend/cloud/transition, exit, and money-management engine.
- Adds guarded commands: `SKIP`, `ARM_LEVEL`, `PAUSE`, `RESUME`, `AUTO`, and `VISUAL`.
- Keeps trade management active while new entries are paused or waiting for a level.
- Adds deterministic weekend voice-command and historical order-book replay in Strategy Tester.
- Reads broker DOM through `WISDO_BROKER_ORDER_BOOK.csv`, written by the local broker sidecar.
- Reads an authenticated external Level II snapshot through `WISDO_ORDER_BOOK.csv`.
- Keeps live-account voice execution behind `DEMO_ONLY` and authenticated confirmation.
- Treats webcam/browser presence only as an assistant wake signal, never permission to trade.

## MT4 compile and demo test

1. In MT4 choose **File → Open Data Folder**.
2. Copy `mql4/Experts/HIGHTOWER_TRIANGLE_FLOW_OS_v1_52_MT4_COMPATIBLE_DUAL_FEED.mq4` into `MQL4/Experts`.
3. Open MetaEditor, compile it, and require **0 errors** before attaching it.
4. Attach it to an M1 demo chart with AutoTrading off. Confirm the original defaults are unchanged.
5. Turn AutoTrading on only on a demo account. Put one command line in the terminal Common Files folder as `WISDO_COMMAND.txt`:
   - `SKIP|5`
   - `ARM_LEVEL|3000|100`
   - `VISUAL|GAMEPLAY`
   - `VISUAL|INSIGHT`
   - `AUTO`
6. Check the Experts log for `WISDO command:` and verify the dashboard state before allowing any order.

## Weekend Strategy Tester with voice behavior

MT4 Strategy Tester cannot reproduce a real historical order-book heatmap and should not depend on live microphone/network timing. It can test the exact voice policy deterministically:

1. Copy `mql4/Files/WISDO_TESTER_VOICE.example.csv` to the MT4 **Common Files** folder and rename it `WISDO_TESTER_VOICE.csv`.
2. Change its timestamps so they fall inside the historical test range.
3. In Strategy Tester select the v1.50 EA, M1, **Every tick**, and Visual mode.
4. Run the test. Each scheduled row is applied when simulated `TimeCurrent()` reaches it.
5. Export the report and inspect the Experts log to verify skipped signals, armed-level waiting, Auto return, and visual mode changes.

An actual iceberg requires Level II/order-book data from a broker or licensed provider. Historical MT4 candles/ticks cannot prove iceberg orders; never label a tick-volume proxy as institutional order-book truth.

## Dual order-book setup

Use `WisdoBookSource=WISDO_BOOK_BOTH`. Older/current MT4 builds do not consistently expose `MarketBookAdd`, `MarketBookGet`, or `MqlBookInfo`, so v1.52 has no compile-time dependency on those APIs. A broker-specific local sidecar writes `WISDO_BROKER_ORDER_BOOK.csv`; the external adapter writes `WISDO_ORDER_BOOK.csv`. Both files use the same normalized seven-field format. Run `scripts/order-book-to-mt4.mjs` on the Windows machine hosting MT4 and configure `WISDO_CLOUD_URL`, `WISDO_DEVICE_TOKEN`, `WISDO_BOOK_SYMBOL`, and `WISDO_MT4_COMMON_FILES`.

The cloud API receives normalized Level II events through `OrderBookFeedService`. A dxFeed or other vendor connector must authenticate with that vendor and submit its snapshots to the protected ingest route. Vendor credentials and exchange entitlements are deliberately not embedded in the EA or repository.

For historical testing, place provider-exported depth rows in `WISDO_ORDER_BOOK.csv` using epoch-seconds, symbol, side, price, size, order count, and sequence. The EA selects rows matching simulated `TimeCurrent()` and rejects stale rows. Broker DOM is unavailable in ordinary historical MT4 tests, so replay uses the external recording.

## Push from this computer

```bash
git clone https://github.com/dfountain99/wisdo-mt4-api-bridge-2.git
cd wisdo-mt4-api-bridge-2
git switch -c agent/wisdo-smart-control-v1-50
# Copy the contents of this package into the matching repository folders.
node --test tests/wisdoSmartControl.test.js
git add mql4/Experts/HIGHTOWER_TRIANGLE_FLOW_OS_v1_52_MT4_COMPATIBLE_DUAL_FEED.mq4 mql4/Files/WISDO_TESTER_VOICE.example.csv mql4/Files/WISDO_ORDER_BOOK.example.csv mql4/Files/WISDO_BROKER_ORDER_BOOK.example.csv services/wisdoSmartControlService.js services/orderBookFeedService.js server/wisdoSmartControlRoutes.js scripts/order-book-to-mt4.mjs tests/wisdoSmartControl.test.js tests/orderBookFeed.test.js docs/INSTALL_AND_TEST.md
git commit -m "Add guarded Wisdo smart voice control and weekend tester"
git push -u origin agent/wisdo-smart-control-v1-50
```

Then open GitHub and create a pull request from `agent/wisdo-smart-control-v1-50` into `main`. Register `registerWisdoSmartControlRoutes(...)` in the existing API server with the authenticated MT4 command bridge; do not deploy an in-memory bridge in production.

## Raspberry Pi update

The existing `pi-edge/wisdo_edge.py` already records WAV audio, uses a local wake word, uploads utterances, polls speech, sends receipts, supports mute, and recognizes emergency interruption. Update it from the same reviewed branch:

```bash
cd ~/wisdo-mt4-api-bridge-2
git fetch origin
git switch agent/wisdo-smart-control-v1-50
git pull --ff-only
cd pi-edge
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart wisdo-edge
sudo systemctl status wisdo-edge --no-pager
journalctl -u wisdo-edge -n 100 --no-pager
```

Set the Pi cloud URL, device token, room ID, microphone, and `WISDO_CONSOLE_MODE` in its existing environment file. Keep console mode `true` for typed weekend tests; use recorded audio for full microphone tests. Do not store tokens in Git.

## Release gate

Do not enable live voice execution until all of these pass: MetaEditor compile, deterministic tester run, demo forward test, command authentication, idempotency/receipt tests, emergency stop, stale-command expiry, maximum risk limits, and a rollback test. Extraordinary backtest growth is not evidence that the same fills, spread, slippage, liquidity, or profit can occur live.
