# S01 Product copy describes a proxy manager

Someone who reads the store listing, the README, or the About tab learns that GeoBypass manages proxies and routes requests by tab, by site, and by request rule. They are not told it defeats region locks.

## Acceptance criteria

1. The description in `assets/manifests/chrome/manifest.json` and in `assets/manifests/firefox/manifest.json` each describe proxy management and routing, and each names only features that work on that browser.
2. `rg -i "geo.?restrict|geo.?block|region.?lock|spoof|streaming" README.md assets src` returns no match.
3. The README still explains the rule hierarchy, the popup, building, and testing. It still links the GeoBypass-Rules repository, described as shared configuration files.
4. The About tab text matches the manifest description and lists the same features as the README.
5. The name GeoBypass, the icons, and the Community Rules button are unchanged.
6. `npm test` passes, and `npm run build:dev:firefox` and `npm run build:dev:chrome` both succeed.
