# S01 Both backgrounds share one implementation

As the maintainer, I change proxy auth, network monitoring, or keep-alive in one place, and both browsers pick up the change.

## Acceptance criteria

1. `src/` holds one handler for proxy auth challenges, and the Firefox and Chrome background entry files both register it.
2. After the Chrome config changes ten times, exactly one auth listener is registered. Covered by a test.
3. `src/` holds one implementation of the network monitoring listeners, and both background entry files register it.
4. Message shapes are defined once. A message of the wrong shape is rejected at runtime by that definition. Covered by a test.
5. Each background entry file registers listeners and calls into the core. It holds no routing, auth, keep-alive, or statistics logic of its own.
6. `test/proxyHierarchy.test.ts` passes with its assertions unchanged.
7. `npm test` passes, and `npm run build:dev:firefox` and `npm run build:dev:chrome` both succeed.
10. The mapping from a proxy to its PAC route string has one home, used by the PAC script, the Chrome proxy test, and the route agreement test.
9. The config load path returns raw stored sections typed as unknown entries, and only the usable views carry the domain types, for both backgrounds and the popup. The dashboard follows in `E04`.
8. `npm test` finishes without "A worker process has failed to exit gracefully" and without "Cannot log after tests are done". Both come from keep-alive checks that outlive the test that started them. No test times out under a full run when it passes alone; `test/auth.refused.test.ts` and `test/background.staleCloudFlag.untouched.test.ts` have each timed out once under load.
