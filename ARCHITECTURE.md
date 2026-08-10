# Architecture

All control surfaces resolve the authenticated user and an exact authorized account before creating work. Trading mutations become command envelopes and travel through the shared MT4 command queue. Reporter polling delivers them; Reporter receipts advance lifecycle state. Interfaces display that state rather than treating HTTP acceptance as execution.

```text
Discord / Web / Voice / Pi
        -> identity + account selection + permission + safety
        -> canonical command envelope
        -> durable command queue
        -> exact Reporter/account/lane
        -> receipt and shared history
```

MT4 snapshot acknowledgement is deliberately small: authenticate, normalize, load the target row, persist the authoritative latest snapshot, then acknowledge. Signal derivation, product ledgers, plan monitoring, rank processing, dashboards, and notifications run after persistence outside the request-critical path.
