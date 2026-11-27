# S01 Invalid config cannot break or widen routing

As a user who imports config from a file, a URL, a GitHub repository, or the Community Rules button, or who upgrades from a released version, I keep a working extension and all of my stored config. A bad entry is refused or set aside with a message that names it. It never proxies traffic I did not ask for, and it is never erased for me.

## Terms

**Valid**

- Pattern (a rule's match, bypass URL, and force proxy URL patterns): accepted by the match pattern library the extension already uses, in its non strict mode.
- `staticExtensions`: absent, empty, or written as `/pattern/flags` where the pattern compiles and the flags are distinct letters from `gimsuy`.
- Rule: has a name, at least one match pattern, and a proxy reference, and every pattern is valid. `bypassResourceTypes`, when present, is a list of resource type names the extension knows. A rule's `staticExtensions` value does not decide whether the rule is valid. A rule without an `active` field is active.
- Keep-alive rule: `active` is true or false, and it has at least one tab URL pattern, each accepted by that field's edit form check.
- Proxy: has an id and a type the extension supports. The host, once trimmed, is not empty and contains no whitespace, no control character, and none of `;`, `/`, `\`, `"`, `'`. The port is an integer from 1 to 65535.
- Test URL (the general one and a keep-alive rule's own): an absolute `http` or `https` URL.
- Website override domain and keep-alive tab URL: accepted by the check that field's edit form already applies.

**Set aside**: a stored entry that is not valid, or is of the wrong type, is set aside. A set aside entry stays in storage, and the extension behaves as if it were not there.

**Before this story**: the code at commit `f024f98`.

## Acceptance criteria

### Loading

1. With set aside entries in storage, the background, the popup, and the dashboard load without an exception, on Firefox and on Chrome. Covered by tests for both backgrounds.
2. Routing with set aside entries in storage is the same as the routing, before this story, of the same config with those entries deleted. Covered by a test on each browser path, with a fixture whose first rule is set aside.
3. Nothing from a set aside rule or proxy reaches the browser: no pattern in the Firefox request filter, no line in the Chrome PAC script, and no host in either. Covered by a test on each browser path.
4. A rule whose `staticExtensions` value is not valid routes as if it had no `staticExtensions` value. Covered by a test.
5. A rule whose proxy is missing or set aside behaves as a rule with a missing proxy did before this story. Covered by a test on each browser path.
6. A `staticExtensions` pattern gives the same answer every time it is asked about the same URL, including with the `g` flag. Covered by a test.
7. A stored test URL that is not valid is not used; the default test URL is used in its place. Covered by a test.
8. A storage change that arrives while the background is running, whether from the popup, the dashboard, or another device, is handled as in criteria 1 to 7, and the background keeps running. Covered by a test on each browser path.
9. Loading writes nothing to the config keys in storage, including when storage is empty. Covered by a test. The tab to proxy map is session state and is outside this criterion.
10. The dashboard shows each set aside rule and proxy as invalid, and each rule with an invalid `staticExtensions` value as invalid. The popup does not list set aside rules. Covered by a test of the validity state the pages render from.

### Saving

11. A save changes only what the user changed. After any save, from a dashboard form, the popup, or an import, every stored entry the user did not edit is stored exactly as it was and in the same order, set aside or not, including its `active` field and any field this version does not know. Covered by tests for a dashboard save, a popup save, and an import save.
12. A whole section of the wrong type, such as `rules` holding a string, is replaced only when the user saves that section. Covered by a test.

### Config from before this story

13. A fixture of config as written before this story loads with every entry still in storage, unchanged. Its rule with `staticExtensions` of `\.(png|css)$` still routes. Its rule with a match pattern of `https://example.com:8080/*` is set aside and shown as invalid. Its proxy with host `proxy_1.lan` is used. Its `testProxyUrl` of `www.google.com` is still in storage. Covered by a test.

### Imports

14. An import refuses each entry that would be set aside: nothing from that entry is saved, and a message names the entry and what is wrong with it. Valid entries in the same file are imported. Covered by tests with a match pattern of `not a pattern`; a proxy with host `a:1; PROXY x:8080`, with a whitespace only host, and with port 70000; and a test URL of `www.google.com`.
15. An import accepts exactly what the loader would use. A rule whose only fault is its `staticExtensions` value, and a keep-alive rule whose only fault is its own test URL, is stored as written, with a message that names it and says the setting is ignored. Covered by tests with `staticExtensions` of `/(/`, `/x/gg`, and `\.(png|css)$`, and with a keep-alive test URL of `www.google.com`.
16. Criteria 14 and 15 hold on every import path: config file, URL, GitHub repository, the Community Rules button, and the per section file imports for rules, proxies, overrides, and keep-alive. The decision every path shares is covered by tests. Each path whose code loads without a DOM has its own test. The URL path is exercised by `npm run smoke:chrome`, importing from a local server. The GitHub listing step has no test until the dashboard is rebuilt.

### Edit forms and popup

17. A dashboard edit form saves an entry only when the entry is valid and its `staticExtensions` value is valid; otherwise nothing is saved and the field is marked. The popup saves an override or a rule change only when the result is valid. Covered by a test of the function that decides whether each save happens.

### Whole story

18. `zod` is declared as a dependency in `package.json` at the version already installed, and `package-lock.json` agrees.
19. `npm test` passes, and `npm run build:dev:firefox` and `npm run build:dev:chrome` both succeed.
