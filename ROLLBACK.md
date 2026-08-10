# Rollback

1. Stop rollout and preserve logs/request IDs.
2. Restore the previously approved application image/commit.
3. Keep additive migration objects unless a reviewed incompatibility requires database restoration.
4. If data integrity is affected, restore the pre-release database checkpoint to a new database and validate before switching.
5. Re-register the previous Discord command manifest only if command compatibility requires it.
6. Verify health, auth, demo Reporter sync/poll/completion, and payment webhook behavior.

Never force-push or rewrite the protected baseline branch as a rollback mechanism.
