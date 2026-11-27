# S05 Imports say what they change in general settings

As a user importing a config file or a shared rule file, I am never left with a different default proxy, fallback setting, or test URL without being told.

Before this story an import that carries `defaultProxy`, `fallbackDirect`, or `testProxyUrl` replaces the stored value silently. A shared file that names a default proxy sends every unmatched request through that proxy.

## Acceptance criteria

1. When an import would change the default proxy, the fallback setting, or the test URL, the user sees each change as old value and new value and chooses to apply or keep each one before anything is saved. Keep is the default. Covered by a test of the function that lists the changes and a smoke step in both browsers.
2. An import that carries the same value as stored, or does not carry the setting, asks nothing about it. Covered by a test.
3. Choosing keep leaves the stored setting exactly as it was; choosing apply stores the imported value. The rest of the import is saved either way. Covered by a test and the smoke step.
4. Every import path behaves the same: config file, URL, GitHub repository, and the Community Rules button. Covered by the shared decision's tests and the URL import smoke step.
5. `npm test`, both dev builds, `npm run smoke:chrome`, and `npm run smoke:firefox` pass.
