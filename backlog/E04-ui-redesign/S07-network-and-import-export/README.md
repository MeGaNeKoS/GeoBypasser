# S07 Network and Import and export sections

As a user, I see my monitored traffic and move my config in and out of the extension in the redesigned sections, and every import shows me one review of what it will change before anything is saved.

## Acceptance criteria

1. The Network section is rebuilt on `src/ui/` as `design.md` describes: the usage tree with chevrons, Refresh, Clear with inline confirm, the "Auto refresh" switch, the Chrome DevTools banner, and its empty, loading, and error states.
2. The Import and export section is rebuilt as `design.md` describes: the Export card opening the Export sheet (groups with per group select all, "Select entire config", "Leave out usernames and passwords" off by default), and the Import card with From a file, From a URL, and Community rules.
3. Every import path (config file, URL, GitHub repository with the "Choose files" step, Community rules, and the per section Import buttons in Proxies, Rules, Sites, and Keep-alive) ends in one Review step before anything is saved: what will be added, refusals and ignored settings word for word, duplicates with their choice (Replace, Keep both where the list allows it, Skip), and changed default proxy, fallback, and test URL with Keep current as the default. The interim duplicate sheets and the one dialog per changed setting are removed.
4. Every rule from `E02/S01`, `E02/S02`, and `E02/S05` still holds on every import path: refusals, kept stored credentials, entries stored as written, nothing saved before the user confirms.
5. The old Network and Import and export code leaves `src/dashboard.ts`, `assets/dashboard.html`, and `assets/dashboard.css`; nothing of the old dashboard page remains outside the new frame.
6. Focus is kept across storage re-renders and sheet returns, as in `E04/S04`.
7. The designer reviews screenshots of both sections, the Export sheet, and the Review step in each of its states in both browsers, light and dark, at 1280 and the narrowest width; a reviewer walks them in real Firefox and Chrome; their findings are fixed in this story.
8. `npm test`, both dev builds, and both smoke tests pass; the smokes import through each path into the Review step and confirm, and export a config with and without credentials.
