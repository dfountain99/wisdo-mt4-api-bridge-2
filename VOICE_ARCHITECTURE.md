# Voice Architecture

Voice is an interface to the same deterministic WISDO core used by text. Speech is transcribed, interpreted into a bounded intent, resolved to an authorized account and entity, safety-classified, confirmed when required, converted to a command envelope, and completed only by a Reporter receipt.

`DEMO_ONLY` remains the protected execution default. This upgrade does not authorize live voice trading. Pi/device retries are bounded and delivery/completion are separate receipts.
