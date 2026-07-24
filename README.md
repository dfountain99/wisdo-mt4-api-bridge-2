# Wisdo Core Alpha

Local Raspberry Pi runtime for the Wisdo hardware ecosystem. It provides a lightweight local API, personalized recognition, account-growth milestone tracking, presence events, text-to-speech hooks, cloud bridge commands, local SQLite durability, and systemd startup.

## Quick start

```bash
cp .env.example .env
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
python -m wisdo_core
```

Open `http://127.0.0.1:8787/health`.

## Raspberry Pi install

```bash
chmod +x scripts/*.sh
./scripts/first_boot.sh
sudo ./scripts/install_pi.sh
sudo systemctl status wisdo-core
```

See `docs/HARDWARE_SETUP.md`, `docs/ARCHITECTURE.md`, and `docs/SECURITY.md`.
