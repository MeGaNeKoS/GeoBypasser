---
status: done
owner: extension
---

# T01 Count consecutive failures before notifying

Done when every acceptance criterion of `E05/S01` holds.

Keep-alive checks and their notifications live in `src/core/keepAlive.ts` and run only in the Firefox background. Before this task the down count was held on the proxy object and the first failed check notified.

Not covered by an automated check: how the notices look in a real Firefox, and what Firefox puts in a `proxy.onError` message, which is now logged on its own.
