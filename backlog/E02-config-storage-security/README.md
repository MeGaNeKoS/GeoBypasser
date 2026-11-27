# E02 Config, storage and security

## Outcome

A user's configuration and proxy credentials are safe at rest and in use. Nothing that arrives from a file, a URL, storage, or another device can stop the extension from working or change routing without the user seeing it. Credentials stay on the device, out of the console, and out of exports unless the user asks for them. A user who opts in gets the same rules, overrides, and settings on every browser signed in to the same account.

## Decisions

- There is one definition of valid config. Everything that puts config into storage (imports, edit forms, the popup) refuses what it rejects. Everything that reads config for routing (startup, a live storage change, sync) sets aside what it rejects.
- Validation never erases stored data. A stored entry that is invalid or of the wrong type is set aside: it stays in storage as it is, the extension behaves as if it were not there, and the user is shown it.
- A save changes only what the user changed. Entries the user did not edit are stored exactly as they were, including fields this version does not know. Loading writes nothing.
- Proxy credentials are stored in plain text in `storage.local` and nowhere else. There is no master password. Browsers keep extension storage away from web pages and other extensions; it is not protected from someone who can read the browser profile on disk.
- Sync is opt in. It carries rules, website overrides, keep-alive rules, general settings, and proxies without their usernames and passwords. Each device enters credentials once.
- Browser sync storage holds 102,400 bytes in total, 8,192 bytes per item, and 512 items, on both Chrome and Firefox. Chrome also limits sync writes to 120 a minute and 1,800 an hour. When config does not fit, the user is told and nothing is lost.
- Firefox sync storage needs an add-on ID in the manifest. The Firefox manifest has none; the published add-on has one assigned by AMO.
- Firefox for Android does not synchronize this storage across devices.

## Exposures as the code stands

Each line is closed by a story under this epic and removed when it is.

- An import replaces the default proxy, the fallback setting, and the test URL without showing the user (`src/dashboard.ts`).
- The Chrome PAC script matches more than the rule says: raw patterns go to `shExpMatch`, force and bypass lines ignore the rule's match, website overrides match by suffix, and the static extension and resource type bypasses are not applied (`src/utils/pac.ts`).
- The Firefox background logs the full config and every storage change, passwords included (`src/background.firefox.ts`). Closed by `S02`.
- The proxies export and the config export include passwords (`src/dashboard.ts`). Closed by `S02`.
- Proxy auth answers a challenge by host and port without checking that it came from a proxy (`src/utils/proxy.ts`). Closed by `S02`.
- Username and password inputs are plain text fields (`assets/dashboard.html`). Closed by `S02`.
- Unused permissions: `cookies` and `activeTab` on Firefox, `notifications` on Chrome. Closed by `S02`.
- Network statistics write to `Object.prototype` when a URL path segment is `__proto__` (`src/utils/network.ts`).
- Cloud mode as written would sync the proxy list with its credentials (`src/utils/storage.ts`).
