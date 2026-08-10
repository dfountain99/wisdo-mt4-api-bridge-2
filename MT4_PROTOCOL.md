# MT4 Reporter Protocol

Reporter requests authenticate with the configured API key and pairing code. `/mt4-sync` validates payload size/schema, normalizes the snapshot, locks it to the paired broker account, coalesces rapid duplicates, and writes only the relevant pairing/account/snapshot/history rows. Post-ACK queues derive copy signals and update WISDO products.

`/mt4-command-poll` returns only commands authorized for that pairing/account and marks delivery. `/mt4-command-complete` records terminal execution receipts. Reporter health derives from heartbeat, successful snapshot, poll/completion timestamps, versions, latency, and failures. Payloads and identifiers are logged in masked/summarized form.
