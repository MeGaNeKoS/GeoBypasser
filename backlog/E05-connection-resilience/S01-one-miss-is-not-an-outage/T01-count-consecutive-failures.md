---
status: open
owner: extension
---

# T01 Count consecutive failures before notifying

Done when every acceptance criterion of `E05/S01` holds.

Keep-alive checks and their notifications live in `src/utils/tab.ts` and run only in the Firefox background. A proxy's down count today is held on the proxy object in memory (`downNotification`) and capped at four notifications.
