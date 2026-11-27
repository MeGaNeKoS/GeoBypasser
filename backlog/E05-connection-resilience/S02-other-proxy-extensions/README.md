# S02 The user knows when another proxy extension is in the way

As a user who has another proxy extension installed, I am told plainly when GeoBypass is not the one routing my traffic, instead of finding out because sites behave wrongly.

Both browsers let one extension control the proxy settings at a time; the most recently installed one wins, and the others are reported `controlled_by_other_extensions` by `proxy.settings.get()` (Chrome types documentation, `ChromeSetting`; Firefox `ExtensionSettingsStore`). Chrome routes GeoBypass through `proxy.settings`, so another extension can take over entirely. Firefox routes GeoBypass through `proxy.onRequest`, where every extension's listener runs in turn and no API reveals the others, so it cannot be detected there.

## Acceptance criteria

1. On Chrome, when `proxy.settings.get()` reports that GeoBypass does not control the proxy setting (`controlled_by_other_extensions` or `not_controllable`), the popup and the dashboard show a warning saying that another extension or a browser policy controls proxy settings, that GeoBypass routing is not in effect, and what to do about it. Covered by a test of the function that turns the level of control into the warning, and a smoke step that stubs the level.
2. The warning appears on startup and whenever the setting changes (`proxy.settings.onChange`), and goes away when GeoBypass is in control again, without a reload. Covered by a test.
3. When GeoBypass regains control on Chrome, its own PAC script is in effect again. Covered by a test.
4. On Firefox, the About section and the Defaults section carry a standing note: other proxy extensions can change where requests go, the browser does not let GeoBypass detect them, and running one proxy extension gives predictable routing.
5. On Firefox, GeoBypass returns no proxy decision for a request no tab proxy, site override, rule, or default proxy applies to, so it does not override another extension's choice for that request. Covered by a test.
6. `npm test`, both dev builds, `npm run smoke:chrome`, and `npm run smoke:firefox` pass.
