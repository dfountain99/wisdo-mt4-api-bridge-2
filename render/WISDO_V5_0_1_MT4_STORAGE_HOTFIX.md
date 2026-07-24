# WISDO V5.0.1 MT4 Storage Concurrency Hotfix

## Production error repaired

`ENOENT: no such file or directory, rename 'data/operator-desks/mt4-commands.json.tmp' -> 'data/operator-desks/mt4-commands.json'`

## Root cause

Concurrent requests wrote to the same fixed temporary filename. One request renamed or removed the shared `.tmp` file while another request still expected it. Concurrent read-modify-write operations could also overwrite each other and silently lose queued MT4 commands.

## Fixes

- unique temporary files for every JSON write
- per-file serialized atomic writes
- cleanup of abandoned temporary files
- cross-device and Windows rename fallbacks
- serialized MT4 read-modify-write operations
- concurrency-safe queue, delivery, completion, failure, expiration, and status updates
- all remaining fixed `.tmp` JSON writers moved to the shared atomic writer
- regression coverage for 40 simultaneous account command writes

## Render configuration

Set both variables on the live service:

```env
DATA_DIR=/var/data/wisdo
WISDO_STORAGE_PATH=/var/data/wisdo
WISDO_PERSISTENCE_MODE=json
```

Attach a persistent disk mounted at `/var/data`. Without the disk, the app can run but JSON state will not survive restarts.

## Validation

- JavaScript files checked: 73
- required assets checked: 9
- tests passed: 6
- tests failed: 0
