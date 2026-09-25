# WISDO Windows Voice

The same edge runtime now supports Windows and Raspberry Pi. Windows uses the
PreSonus (or selected Windows input), PowerShell audio playback, cloud speech,
device permissions, conversation sessions, emergency interruption, and the
existing MT4 command safety contract.

## Install

1. Open PowerShell in the repository.
2. Run `powershell -ExecutionPolicy Bypass -File .\pi-edge\install-windows.ps1`.
3. Edit `pi-edge\.env` and enter the enrollment code from WISDO.
4. Run `pi-edge\enroll-windows.cmd` once.
5. Run `pi-edge\start-wisdo-windows.cmd`.

Say **Hey Coach** once. After WISDO answers, keep speaking naturally for up to
90 seconds. Say **Coach, stop** to interrupt playback. Press **Ctrl+C** to stop
the edge program.

## False wake protection

The old `1.0` PocketSphinx keyword sensitivity treated ordinary sound as the
wake word. The runtime now defaults to `1e-20`, applies a wake cooldown, blocks
self-triggering immediately after speaker playback, and does not listen for a
fresh wake word while a conversation session is active.

If the room is unusually noisy, use `WISDO_WAKE_SENSITIVITY=1e-25`. If a clear
"Hey Coach" is missed, use `1e-18`. Do not use `1.0`.
