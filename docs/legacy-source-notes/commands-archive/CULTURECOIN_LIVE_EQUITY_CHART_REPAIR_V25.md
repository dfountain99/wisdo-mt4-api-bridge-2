# CultureCoin Live Equity Chart Repair V25

Fixes Discord desk live equity charts by triggering dashboard refresh directly after `/mt4-sync`, using unique chart attachment filenames, adding SVG fallback rendering, and adding an equity sparkline in the Discord message when image rendering fails.

## Env Options

```env
WISDO_DASHBOARD_UPDATE_SECONDS=15
WISDO_CHART_ENGINE=chartjs
WISDO_CHART_WIDTH=980
WISDO_CHART_HEIGHT=460
```

Set `WISDO_CHART_ENGINE=off` to disable image attachments and use text sparkline fallback only.
