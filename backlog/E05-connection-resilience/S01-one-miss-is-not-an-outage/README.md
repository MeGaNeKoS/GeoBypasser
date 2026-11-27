# S01 One failed check is not an outage

As a user with "notify if down" on, I am not interrupted when a proxy misses a single check. I am told once when the proxy has stayed down, and once when it is back.

Before this story, keep-alive checks a proxy every 15 seconds, and the first failed check raises an error notification, repeated on each of the next three failures.

## Acceptance criteria

1. A proxy that fails one or two consecutive checks produces no notification. Covered by a test.
2. A proxy that fails three consecutive checks produces exactly one notification saying it is down, and no further notification while it stays down. Covered by a test.
3. After a failed check, the next check runs within 5 seconds, so a proxy that stays down is reported within 15 seconds of its first failed check. Covered by a test.
4. When a proxy that was reported down passes a check, the user gets exactly one notification saying it is back, and the failure count starts again from zero. Covered by a test.
5. Both notifications name the proxy by its label, or by host and port when it has no label.
6. A proxy with "notify if down" off produces no notification in any of these cases. Covered by a test.
7. `npm test` passes, and `npm run build:dev:firefox` and `npm run build:dev:chrome` both succeed.
