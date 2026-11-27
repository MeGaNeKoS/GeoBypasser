# S02 Proxy credentials stay where they belong

As a user with an authenticated proxy, my username and password are used only to answer that proxy, are never written to a log, never leave in an export unless I ask, and are not shown on screen unless I ask.

## Acceptance criteria

1. No `console` call in `src/` passes a proxy password, or an object that holds one, in either background, the popup, the dashboard, or a utility. Covered by a test that loads both backgrounds, the storage layer, and the auth handlers with a config whose password is a known marker string, exercises startup, a live storage change, an auth challenge, and a proxy test, and fails if the marker appears in any captured `console` output.
2. A username appears in a log only as present or absent, never as its value. Covered by the same test with a username marker.
3. Proxy auth answers a challenge only when the browser reports it came from a proxy. A server challenge from the same host and port as a configured proxy gets no credentials. Covered by a test on each browser path.
4. Every export holds everything an import needs to use it, usernames and passwords included, so a file exported on one browser works when imported on another. The config export dialog has one control, "Leave out usernames and passwords", off each time the dialog opens, for a file meant to be shared. Covered by a test of the function that builds each export.
5. Importing a proxy without credentials keeps the credentials already stored for a proxy with the same id, on every import path. Covered by a test.
6. The username and password inputs in the proxy form and in diagnostics are `type="password"` for the password and do not autofill from the browser's saved logins. Covered by the Chrome and Firefox smoke tests reading the input attributes.
7. The manifests request no permission the code does not use: `cookies` and `activeTab` are gone from Firefox, `notifications` is gone from Chrome. Every remaining permission has a caller in the code for that browser. Covered by a test that reads each manifest and checks each permission against a list of its callers.
8. `npm test`, both dev builds, `npm run smoke:chrome`, and `npm run smoke:firefox` pass.
