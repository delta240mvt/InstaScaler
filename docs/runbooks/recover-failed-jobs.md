# Recover failed jobs

1. Open `/diagnostics` and identify the external ID, account and error class.
2. Fix permanent configuration failures first (expired token, revoked permission, invalid Meta app settings).
3. For a transient Queue failure, leave the R2 object intact. The hourly `RecoverJournalWorkflow` republishes envelopes that have no terminal `ProcessedEvent`.
4. For a DLQ message, confirm its R2 key still exists, then republish the compact job body to `instascaler-events`. Do not recreate or edit the envelope.
5. Confirm one terminal `ProcessedEvent`, one delivery side-effect key and removal of the R2 object. Duplicate messages are safe and should finish as `DUPLICATE_EVENT` or `DUPLICATE_DELIVERY`.

Never delete the R2 journal to clear an alert. Remove an object only after Neon contains a terminal result or after you have intentionally abandoned and documented the event.
