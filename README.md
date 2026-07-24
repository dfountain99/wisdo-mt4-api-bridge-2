# WISDO Unified Ecosystem v1.0

One command path across Render, Raspberry Pi, Windows, member portal, bots, and Reporters.

## Components
- `render/`: existing WISDO v7.0.8 upgraded with PostgreSQL command bus.
- `pi-edge/`: voice/wake gateway that sends authorized commands and speaks results.
- `desktop-agent/`: Windows agent that discovers terminals, registers bots, leases commands, and acknowledges execution.
- `shared/`: versioned command contract.

## Safety
Trading commands require an enrolled device and target resolution. The desktop agent currently writes commands into a durable local Reporter inbox. Reporter-specific execution adapters should consume that inbox and enforce their existing safety rules.
