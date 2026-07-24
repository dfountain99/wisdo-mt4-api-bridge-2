# Security

- Never commit `.env` or device tokens.
- Do not store broker passwords on the Raspberry Pi.
- Route trading actions through the Wisdo cloud permission layer.
- Use a unique device token and rotate it if exposed.
- Keep Raspberry Pi OS and packages updated.
- Restrict port 8787 to the local network unless protected by a reverse proxy and authentication.
