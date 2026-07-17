# WISDO v6.0.1 Windows Install Hotfix

This maintenance release fixes two packaging defects found during Windows installation:

1. `scripts/checkBuild.js` now uses `fileURLToPath()` so Windows drive-letter paths are resolved correctly instead of producing paths such as `C:\\C:\\Users\\...`.
2. `package-lock.json` no longer contains internal build-environment package URLs. All package tarballs resolve through the public npm registry.

The application feature set is unchanged from v6.0.0.
