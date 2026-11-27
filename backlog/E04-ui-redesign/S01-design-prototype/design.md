# Design: "Quiet console"

Produced by the `ideator` agent (Fable), revision 2. The designer has full control of the design within the owner's decisions below. Nothing here is rendered yet; layout, 360 px behaviour and focus order are intent until the prototype runs. Contrast ratios were computed with the WCAG formula.

## Owner decisions

The owner approved the "Quiet console" direction and decided:

1. Proxy DNS and failover timeout are editable fields in the proxy editor, and the failover timeout bug is fixed so the value is used.
2. Website overrides work on Chrome with limited function, through the PAC script: on Chrome an override applies to requests whose host is that site, not to everything a tab on that site loads. The Sites section and the popup's "This site" scope are available on Chrome, with that difference stated.
3. All four behaviour changes are in: inline confirm before delete, inline banners instead of `alert()`, one import Review step before saving, and the popup lists every rule in a scrolling list.
4. The designer has full control of the design within these decisions.

## Notes for the build

- DNS through proxy and failover timeout have no effect on Chrome, whose PAC route is only `SCHEME host:port`. They are editable there and badged "Firefox only".
- Failover timeout is a whole number of seconds, 1 or more; empty means the default. A stored value that is not one is "Setting ignored", not set aside.
- The popup's Test proxy stays Firefox only and points Chrome users to Test in the dashboard.
- Set aside overrides and keep-alive rules must be returned to the page with an invalid flag and their faults; today `overrideRows` and `keepAliveRows` in `src/utils/pageView.ts` return usable entries only.

## Framing

The popup's job is "what is this tab using, change it, flip a rule". The dashboard's job is "add a proxy, point traffic at it, find out why something is not working". So: one list pattern for the four collections, one editor pattern (a side sheet) with advanced fields folded but never hidden, one status language (icon plus words).

## Information architecture

Nine sections, addressed by URL hash (`#proxies`, `#rules`, ...). The landing section is Proxies.

| Group | Section | Was |
| --- | --- | --- |
| Set up | Proxies | Proxy List |
| Set up | Rules | Rules |
| Set up | Sites | Website Overrides |
| Set up | Keep-alive | Keep-Alive |
| Set up | Defaults | General |
| Tools | Test | Diagnostics |
| Tools | Network | Network |
| Tools | Import and export | Import/Export |
| Tools | About | About |

- The popup's Dashboard button opens the dashboard; "N rules need fixing" opens `#rules` filtered.
- Sidebar at 720 px and wider; below, a top bar whose section button opens a full width menu.
- Every add, edit or fix opens a Sheet (native `<dialog>`, `showModal()`): right panel 480 px when wide, full screen below 720 px.
- No dialog on dialog: the pattern list, resource type, duplicate and imported setting modals become inline parts of a sheet.
- All import sources converge on one Review step, the only place an import is confirmed.

## Design tokens

One `tokens.css` loaded by all three pages; no other file contains a raw colour, pixel size or font size.

Spacing (4 px base): `--space-1` 4, `--space-2` 8, `--space-3` 12, `--space-4` 16, `--space-5` 24, `--space-6` 32, `--space-7` 48.

Type: `--font-ui` `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`; `--font-mono` `ui-monospace, "Cascadia Mono", Consolas, Menlo, monospace` for hosts, ports, domains, patterns and paths. Weights 400 and 600.

| Token | Size / line height | Use |
| --- | --- | --- |
| `--text-xs` | 12 / 16 | badges, group labels (uppercase, 0.04em) |
| `--text-sm` | 13 / 18 | help text, meta |
| `--text-md` | 14 / 20 | body, controls |
| `--text-lg` | 16 / 24 | sheet title, popup domain |
| `--text-xl` | 20 / 28 | section title |

Under `pointer: coarse`, inputs and selects use 16 px.

Shape and size: `--radius-1` 4, `--radius-2` 8, `--radius-pill` 999. `--control-h` 32 (44 coarse). `--row-min-h` 44 (56 coarse). `--popup-row-h` 36 (44 coarse). 1 px borders; `--shadow-overlay` on sheet and nav menu only. `--sidebar-w` 216, `--content-max` 960, `--sheet-w` 480, `--popup-w` 360. One breakpoint `--bp-wide` 720 px. Motion `--dur` 120 ms ease-out, 0 under `prefers-reduced-motion`.

Colour roles (light default, dark under `prefers-color-scheme: dark`):

| Role | Light | Dark | Contrast light / dark |
| --- | --- | --- | --- |
| `--bg` | #F6F7F9 | #101216 | |
| `--surface` | #FFFFFF | #181B21 | |
| `--surface-sunken` | #EEF0F3 | #20242C | |
| `--border` | #D5D9E0 | #2E333D | decorative |
| `--border-strong` | #7C8594 | #6B7483 | 3.72 / 3.66 |
| `--text` | #171A21 | #E8EAEE | 17.41 / 14.32 |
| `--text-muted` | #545C6B | #A3ABB8 | 6.73 / 7.45 |
| `--accent` | #0B6B5D | #4FD1B8 | 6.41 / 9.15 |
| `--on-accent` | #FFFFFF | #06231E | 6.41 / 8.80 |
| `--accent-bg` | #E0F2EE | #12332E | 5.53 / 7.24 |
| `--danger` | #B3261E | #FF8A80 | 6.54 / 7.56 |
| `--on-danger` | #FFFFFF | #2B0A07 | 6.54 / 8.00 |
| `--danger-bg` | #FCE8E6 | #3A1C1A | 5.55 / 6.76 |
| `--warn` | #7A4B00 | #F2C15A | 7.41 / 10.31 |
| `--warn-bg` | #FFF1CC | #33290F | 6.60 / 8.57 |
| `--ok` | #1B6B34 | #6FD08C | 6.56 / 9.10 |
| `--ok-bg` | #E3F4E8 | #14301D | 5.74 / 7.53 |
| `--focus` | #1F5FD6 | #8AB4FF | 5.73 / 8.26 |

Focus: `:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px }` everywhere, never removed.

## Visual direction

Flat and quiet: hairline borders, no gradients, shadows only on overlays. One teal accent for the primary action, switch on state, links and the selected nav mark. Network identifiers in mono. Compact with a pointer, comfortable on touch. Labels above fields, help below in muted small text. Sentence case, no exclamation marks, buttons are verbs.

## Components

| Component | Spec |
| --- | --- |
| Button | `primary` (one per view), `secondary`, `quiet`, `danger` (fill only inside a confirm). States: hover, focus-visible, disabled (55% opacity plus `disabled`), busy ("Saving…", `aria-busy`). |
| Switch | `<button role="switch" aria-checked>`, 36 by 20 track, followed by the word "On" or "Off". |
| Segmented | Radio group drawn as joined buttons: popup scope, proxy type, popup rule filter, duplicate choice, imported setting choice. One option can be `disabled`; it shows its own reason line only when no adjacent note explains it. |
| Field | Label, control, help, error. Error is icon plus text in `--danger`, `aria-describedby`; control gets `aria-invalid` and a 2 px danger border. A number field can carry a unit suffix ("seconds") inside its right edge. |
| Select, Checkbox | Native, styled with tokens. |
| Badge | Pill with icon and text: `invalid` "Not used", `ignored` "Setting ignored", `unavailable` "Proxy unavailable", `firefox` "Firefox only", `limited` "Limited on Chrome", `count`. |
| Banner | Strip with icon, text, optional action. Error `role="alert"`, others `role="status"`. |
| ListSection | Header, toolbar, optional banner, rows. Shared by Proxies, Rules, Sites, Keep-alive. |
| Row | `<li>` on CSS grid; stacked card below 720 px. |
| Sheet | `<dialog>` with title bar, scrolling body, sticky footer Save and Cancel. Esc closes, focus returns. A dirty form asks "Discard changes? [Discard] [Keep editing]". |
| Disclosure | A `<details>` group inside a sheet; the summary shows the group name and a short state ("2 in use", "Defaults in use"); opens itself when a field inside has a non default value or a fault. Used by rule Exceptions and proxy Advanced. |
| PatternList | Edits a string list in place: mono input plus Remove per row, "Add pattern", per row validation, help link. |
| TypeGrid | Checkbox grid (2 columns narrow, 3 wide) for the 21 resource types. |
| Tree | Nested `<details>`, for network usage and the GitHub file tree. |
| Status line | Polite `aria-live` region for "Saved", test results, counts. |

Icons: about 14 inline SVG symbols in one sprite in the repository, each with text or an `aria-label`.

## Shared list pattern

- Header: title, one line of help, primary Add.
- Toolbar: select all, Import, Export all. With a selection: "N selected", Export selected, Delete selected. Proxies also has "Show all passwords".
- Row actions are visible text buttons: Edit, Delete, and Export on rules. No overflow menus.
- Delete: row actions replaced in place by "Delete this proxy? [Delete] [Cancel]", focus on Cancel. Delete selected asks in the toolbar: "Delete 2 proxies? [Delete] [Cancel]".
- Inline toggles (rule Active, keep-alive Active, proxy Notify) save at once; status line says "Saved".
- Messages are never `alert()`. A save failure is an error Banner pinned at the top with Dismiss (in the popup, an error line under the header). A refused save keeps the sheet open with the fault summary and each field at fault marked. Import messages appear in the Review step.

## Other sections

Defaults: one card, 480 px max. Default proxy (None plus usable proxies); "If a proxy fails, connect directly" switch; Test URL (http or https); "Clear all tab proxies" with inline confirm (Firefox only).

Test: Test URL prefilled from Defaults. "Saved proxy" card: select, Test, Edit. "Custom proxy" card: Type, Host, Port, Username, Password (masked, Show), Test, "Add to list" (opens the proxy sheet prefilled). Result panel: idle "No test run yet", busy "Testing…", success "Connected through host:port", failed "Failed: reason". The timeouts note stays as help text.

Network: Refresh, Clear (inline confirm), "Auto refresh" switch (5 s). Tree rows with Sent and Received right aligned; below 720 px they drop under the name. Empty "No traffic recorded yet. Turn on Monitor for a tab from the popup." Loading: 4 skeleton rows. Error "Could not read usage from the extension. [Retry]".

Import and export: the Export card opens the Export sheet (four groups with per group Select all, "Select entire config", "Leave out usernames and passwords" off by default, for a file meant to be shared). Import card: From a file, From a URL, Community rules; every row ends in the Review step.

About: name and version, description, rule priority, features, licence, links. On Chrome, priority tier 1 (tab) carries "Firefox only" and tier 2 (site) carries "Limited on Chrome" with "On Chrome this covers requests to the site and its subdomains only." The features list item "Domain-based overrides" carries the same badge.

Devtools panel: one centred line. Active "Network monitoring is on for this tab while DevTools is open. See usage in the dashboard under Network." Loading "Connecting to the extension…". Error "Not connected to the extension. Close and reopen DevTools."

Proxy sheet, fields in order:

1. Label.
2. Type: Segmented, HTTP or SOCKS5.
3. Host and Port: mono, side by side when wide.
4. Username.
5. Password: masked, Show button.
6. "Notify if down": switch. Help "Needs a keep-alive rule for this proxy. You are told after 3 failed checks in a row, and again when it responds." On Chrome the help starts with the "Firefox only" badge.
7. "Advanced" Disclosure, collapsed for a new proxy; summary "Defaults in use" or "1 changed" / "2 changed".
   - "Resolve DNS through the proxy": Switch, default On. Help with SOCKS5: "Site names are looked up by the proxy, not by this device." With HTTP the switch is replaced by the locked text "Always on the proxy side for HTTP proxies"; the stored value is kept and returns if Type goes back to SOCKS5.
   - "Failover timeout": number Field, suffix "seconds", whole number 1 or more, empty allowed, placeholder "Default". Help "How long to wait on this proxy before treating it as failed. Leave empty for the default: 3 seconds, or 30 for an HTTP proxy with a username." Error "Enter a whole number of seconds, 1 or more, or leave empty."
   - On Chrome the group summary carries "Firefox only" and the first line inside reads "Chrome ignores both settings. They are saved and take effect in Firefox." Both stay editable.

Site override sheet: Domain (mono) and Proxy (including Direct). Domain help on Firefox: "Covers tabs on this domain and its subdomains, including everything those pages load." On Chrome: "Covers requests to this domain and its subdomains. Things the page loads from other hosts are not covered."

Keep-alive sheet: Proxy (one rule per proxy), Active, Tab URL patterns (PatternList; "Hostname such as example.com or *.example.com"), optional Test URL with the Defaults value as placeholder.

## Wireframes

Popup, Firefox (360 px):

```
+------------------------------------------+
| GeoBypass             [Dashboard]   [x]  |
+------------------------------------------+
| THIS TAB                                 |
| video.example.com                        |
| Using: Tokyo SOCKS (set for this tab)    |
|                                          |
| Proxy                                    |
| [ Tokyo SOCKS                        v ] |
| Apply to                                 |
| [ This tab | This site ]                 |
| [ Set ]  [ Clear ]       [ Test proxy ]  |
| (ok) Connected through 203.0.113.7:1080  |
+------------------------------------------+
| Monitor this tab              (o  ) Off  |
+------------------------------------------+
| RULES       [ Active 7 | Inactive 5 ]    |
| +--------------------------------------+ |
| | (  o) On   Streaming JP             ^| |
| | (  o) On   News UK                  || |
| | (  o) On   Music US                 || |
| | (  o) On   Sports DE                || |
| | (  o) On   Library FR               v| |
| | (  o) On   Radio IT   (cut off row)  | |
| +--------------------------------------+ |
| /!\ 2 rules need fixing. Open dashboard  |
+------------------------------------------+
```

The rule list holds every rule in the chosen filter, capped at 5.5 rows of `--popup-row-h` with `overflow-y: auto` so a cut off row shows there is more. It is a `<ul>`; each switch is in the tab order, so keyboard focus scrolls it. On Android, where the popup is a full page, the cap is removed. Empty filter: "No active rules" or "No inactive rules". No rules: "No rules yet. Open dashboard".

Popup, Chrome:

```
+------------------------------------------+
| GeoBypass             [Dashboard]   [x]  |
+------------------------------------------+
| THIS TAB                                 |
| video.example.com                        |
| Using: Tokyo SOCKS (set for this site)   |
|                                          |
| Proxy                                    |
| [ Tokyo SOCKS                        v ] |
| Apply to                                 |
| [ This tab (disabled) | This site ]      |
| [ Set ]  [ Clear ]   [ Test proxy (dis.)]|
|                                          |
| (i) On Chrome                            |
|     A site proxy covers requests to      |
|     video.example.com and its            |
|     subdomains, not other hosts the      |
|     page loads from.                     |
|     Per tab proxies and Test proxy here  |
|     are Firefox only. Test in dashboard  |
+------------------------------------------+
| Monitor this tab              (o  ) Off  |
| (i) Keep DevTools open while monitoring. |
+------------------------------------------+
| RULES       [ Active 7 | Inactive 5 ]    |
| (same scrolling list)                    |
+------------------------------------------+
```

Same markup as Firefox; the popups differ only by `disabled` attributes and the note. "This site" is preselected; "This tab" and Test proxy are `disabled`. The "Using" line reads "Using: label (set for this site)" or "No site proxy". The note is `role="note"`, headed "On Chrome", names the active domain, and "Test in dashboard" links to `#test`. Set and Clear write and remove the site override exactly as on Firefox.

Dashboard frame, 720 px and wider:

```
+------------------+------------------------------------------------------+
| GeoBypass        | Proxies                               [ + Add proxy ]|
|                  | Servers your traffic can go through.                 |
| SET UP           +------------------------------------------------------+
| | Proxies      4 | [banner slot: save failure / needs fixing / browser] |
|   Rules   12 /!\2|                                                      |
|   Sites        3 | [toolbar]                                            |
|   Keep-alive   1 | [rows]                                               |
|   Defaults       |                                                      |
|                  |                                                      |
| TOOLS            |                                                      |
|   Test           |                                                      |
|   Network        |                                                      |
|   Import and     |                                                      |
|     export       |                                                      |
|   About          | Saved                              (status line)     |
+------------------+------------------------------------------------------+
```

Selected nav item: 3 px accent bar, sunken background, 600 weight, `aria-current="page"`. "/!\2" has the accessible name "2 need fixing". On Chrome the browser badge sits beside each section's title and in its banner, not in the nav; the nav's trailing slot shows only the warning count.

Dashboard frame, 360 px:

```
+----------------------------------+      menu open:
| [=] Proxies                    v |     +----------------------------------+
+----------------------------------+     | [x] Sections                     |
| Proxies                          |     | SET UP                           |
| Servers your traffic can go      |     | | Proxies                     4  |
| through.                         |     |   Rules               12  /!\ 2  |
| [ + Add proxy                  ] |     |   Sites                       3  |
| [banner slot]                    |     |   Keep-alive                  1  |
| [toolbar, wraps]                 |     |   Defaults                       |
| [row cards]                      |     | TOOLS                            |
+----------------------------------+     |   Test  ...                      |
                                         +----------------------------------+
```

Proxy list, populated:

```
| [ ] Select all   [ Import ] [ Export all ]        [ Show all passwords ]|
| 2 selected:  [ Export selected ]  [ Delete selected ]                   |
+-------------------------------------------------------------------------+
| [x] Tokyo SOCKS   SOCKS5  203.0.113.7:1080   user: aki                  |
|     Password ****** [Show]   Notify if down (  o) On   [Edit] [Delete]  |
+-------------------------------------------------------------------------+
| [x] London HTTP   HTTP    198.51.100.4:8080  no sign in                 |
|     Notify if down (  o) On                            [Edit] [Delete]  |
|     (i) No keep-alive rule for this proxy, so no notices. Add one       |
+-------------------------------------------------------------------------+
|/!\ [ ] (no label)  SOCKS5  proxy host:(missing)    [ Not used ]         |
|     Host contains a space. Port is missing.            [Fix]  [Delete]  |
+-------------------------------------------------------------------------+
```

The "No keep-alive rule" line appears only when Notify is On and no keep-alive rule exists for that proxy; "Add one" opens the keep-alive sheet with the proxy preselected.

Proxy row as a card, 360 px:

```
+----------------------------------+
| [ ] Tokyo SOCKS          SOCKS5  |
| 203.0.113.7:1080                 |
| user: aki   ****** [Show]        |
| Notify if down        (  o) On   |
| [ Edit ]              [ Delete ] |
+----------------------------------+
```

Proxy editor (Sheet):

```
+----------------------------------------------+
| Edit proxy                               [x] |
+----------------------------------------------+
| Label                                        |
| [ Tokyo SOCKS                              ] |
| Type                                         |
| [ HTTP | SOCKS5 ]                            |
| Host                          Port           |
| [ 203.0.113.7              ]  [ 1080 ]       |
| Username                                     |
| [ aki                                      ] |
| Password                                     |
| [ ******                          ] [ Show ] |
| Notify if down                    (  o) On   |
|   Needs a keep-alive rule for this proxy.    |
|   You are told after 3 failed checks in a    |
|   row, and again when it responds.           |
|                                              |
| v ADVANCED                        1 changed  |
|   Resolve DNS through the proxy   (  o) On   |
|     Site names are looked up by the proxy,   |
|     not by this device.                      |
|   Failover timeout                           |
|   [ 10                             seconds ] |
|     How long to wait on this proxy before    |
|     treating it as failed. Leave empty for   |
|     the default: 3 seconds, or 30 for an     |
|     HTTP proxy with a username.              |
+----------------------------------------------+
| [ Save proxy ]  [ Cancel ]                   |
+----------------------------------------------+

With Type = HTTP, the DNS row reads:
|   Resolve DNS through the proxy              |
|     Always on the proxy side for HTTP        |
|     proxies.                                 |

On Chrome, the group reads:
| v ADVANCED  [ Firefox only ]      1 changed  |
|   Chrome ignores both settings. They are     |
|   saved and take effect in Firefox.          |
```

Proxy list states:

```
EMPTY
|                         No proxies yet                                  |
|        Add a proxy to start routing traffic, or import a file.          |
|                 [ + Add proxy ]   [ Import proxies ]                    |
  (toolbar hidden; header Add stays)

LOADING   (aria-busy; 3 skeleton rows at real row height, shown after 150 ms)
| [ ] ########      ####    ###############                               |
| [ ] ##########    ####    ############                                  |
| [ ] #######       ####    ##############                                |

ERROR   (role="alert"; Add and toolbar disabled until a read succeeds)
| /!\ Could not load your proxies                                         |
|     The saved settings could not be read: <browser message>             |
|     [ Try again ]                                                       |
```

Rules list, populated:

```
| [ ] Select all   [ Import ] [ Export all ]                              |
+-------------------------------------------------------------------------+
| /!\ 2 rules are not used because they are invalid.  [ Show only these ] |
+-------------------------------------------------------------------------+
| [ ] (  o) On   Streaming JP        via Tokyo SOCKS                      |
|     *://*.video.example/*  +2 more            [Edit] [Export] [Delete]  |
+-------------------------------------------------------------------------+
| [ ] (  o) On   News UK             via London HTTP  [ Setting ignored ] |
|     *://news.example/*                                                  |
|     Static extensions is not a valid pattern, so it is ignored.         |
|     The rule still works.                     [Edit] [Export] [Delete]  |
+-------------------------------------------------------------------------+
| [ ] (o  ) Off  Music US            via 7f3a…  [ Proxy unavailable ]     |
|     *://music.example/*                                                 |
|     Its proxy is missing or invalid.          [Edit] [Export] [Delete]  |
+-------------------------------------------------------------------------+
|/!\ [ ] Off, locked  (no name)      via Tokyo SOCKS      [ Not used ]    |
|     htp:/bad pattern                                                    |
|     Name is missing. Match pattern 1 is not valid.                      |
|                                               [Fix]  [Export] [Delete]  |
+-------------------------------------------------------------------------+
```

Rules list states:

```
EMPTY
|                           No rules yet                                  |
|     A rule sends matching requests through a proxy you choose.          |
|     [ + Add rule ]  [ Import rules ]  [ Browse community rules ]        |
  (with no proxies either: "Add a proxy first, or route a rule to Direct."
   [ Go to Proxies ])

NO RESULT (filter on, nothing left)
|     Nothing left to fix.   [ Show all rules ]                           |

LOADING   3 skeleton rows, as for proxies

ERROR
| /!\ Could not load your rules                                           |
|     The saved settings could not be read: <browser message>             |
|     [ Try again ]                                                       |
```

Rule editor (Sheet):

```
+----------------------------------------------+
| Edit rule                                [x] |
+----------------------------------------------+
| /!\ 2 things to fix          (fix mode only) |
|     Name is missing                          |
|     Match pattern 1 is not valid             |
|                                              |
| BASICS                                       |
| Name                                         |
| [ Streaming JP                             ] |
| Active                            (  o) On   |
| Send through                                 |
| [ Tokyo SOCKS                            v ] |
| Match patterns                               |
| [ *://*.video.example/*            ] [Remove]|
| [ htp:/bad pattern                 ] [Remove]|
|   /!\ Not a valid match pattern              |
| [ + Add pattern ]   What is a match pattern? |
|                                              |
| IF THE PROXY FAILS                           |
| Connect directly instead          (  o) On   |
|                                              |
| v EXCEPTIONS                      2 in use   |
|   Never proxy these URLs                     |
|   [ + Add pattern ]                          |
|   Always proxy these URLs                    |
|   [ *://*.video.example/api/*      ] [Remove]|
|   [ + Add pattern ]                          |
|   Never proxy these resource types           |
|   [x] image   [x] media   [ ] font           |
|   [ ] script  [ ] stylesheet  ... (21)       |
|   Static extensions                          |
|   [ /\.(jpg|png|css)$/                     ] |
|   A JavaScript regular expression. Examples  |
+----------------------------------------------+
| [ Save rule ]  [ Cancel ]                    |
+----------------------------------------------+
```

Save is always enabled; pressing it validates, shows the summary, and moves focus to the first faulty field. Exceptions is collapsed for a new rule ("None in use").

Sites section, Chrome:

```
| Sites  [ Limited on Chrome ]                          [ + Add site ]    |
| Send one site through a proxy, or directly.                             |
+-------------------------------------------------------------------------+
| (i) On Chrome, a site proxy covers requests to that site and its        |
|     subdomains only. Things a page loads from other hosts follow your   |
|     rules and default proxy. On Firefox it covers everything a tab on   |
|     that site loads.                                                    |
+-------------------------------------------------------------------------+
| [ ] Select all   [ Import ] [ Export all ]                              |
+-------------------------------------------------------------------------+
| [ ] video.example.com          via Tokyo SOCKS        [Edit] [Delete]   |
| [ ] bank.example.org           Direct                 [Edit] [Delete]   |
+-------------------------------------------------------------------------+
```

On Firefox the banner and badge are absent, and the help line reads "Send everything a tab on one site loads through a proxy, or directly." On Chrome the info banner is always shown and not dismissible. The list, sheet, import and export work fully on both browsers.

Import flow:

```
Import card
| IMPORT                                                                  |
| From a file          [ Choose file ]                                    |
| From a URL           [ https://…                        ] [ Import ]    |
|                      A raw .json link or a GitHub repository address    |
| Community rules      [ Browse ]   Shared rules for known sites          |

Step "Choose files" (repository URL or Community rules)
| Choose files                             [x] |
| owner/repository                             |
| [ Select all ] [ Unselect all ]  7 selected  |
| v [x] services                               |
|     [x] video.json                           |
|     [x] music.json                           |
| v [x] proxies                                |
|     [ ] public.json                          |
| [ Continue ]  [ Cancel ]                     |
  loading "Reading file list…"; empty "No .json files found in this
  repository."; error "Could not read the repository. [ Try again ]"

Step "Review" (every source; nothing is saved before Import is pressed)
+----------------------------------------------+
| Review import                            [x] |
| TO ADD                                       |
|   4 rules, 1 proxy, 2 keep-alive rules       |
|                                              |
| NEEDS YOUR ATTENTION (3)                     |
|   /!\ Rule "Old" was not imported: match     |
|       pattern "htp:/x" is not valid.         |
|   /!\ Proxy "entry 3" was not imported: a    |
|       field is missing or has the wrong type.|
|   (i) Rule "News" has a staticExtensions     |
|       value that is not valid, so that       |
|       setting is ignored.                    |
|                                              |
| ALREADY IN YOUR LIST (1)                     |
|   203.0.113.7:1080                           |
|   [ Keep existing | Use new | Keep both ]    |
|                                              |
| SETTINGS IN THIS FILE (2)                    |
|   Default proxy                              |
|   Current: London HTTP   Imported: Tokyo     |
|   [ Keep current | Use imported ]            |
|   Test URL                                   |
|   Current: https://a.example/                |
|   Imported: https://b.example/               |
|   [ Keep current | Use imported ]            |
+----------------------------------------------+
| [ Import ]  [ Cancel ]                       |
+----------------------------------------------+
```

Review rules:

- "Needs your attention" shows each message from the import check word for word; "was not imported" lines carry the warning icon, "is ignored" lines the info icon.
- "Settings in this file" replaces the one dialog per changed setting: one row per changed default proxy, fallback to direct, or test URL, each defaulting to "Keep current".
- Each duplicate defaults to "Keep existing".
- An empty group is not rendered. If nothing can be added and no setting is offered, "To add" reads "Nothing in this file can be imported" and Import is disabled.
- After Import the sheet closes, the status line reads "Imported 4 rules, 1 proxy, 2 keep-alive rules", and focus returns to the opener.
- Bad JSON or an HTTP failure shows in the sheet body with [ Choose another ] [ Cancel ].
- The Import button in each list toolbar opens the file picker and then this same step.

## Set aside entries

Shown in the entry's normal list: warning icon in the gutter, 3 px `--warn` stripe, "Not used" badge, and a reason line with one sentence per fault. Unreadable values shown raw in mono, absent ones as "(missing)". A set aside rule's switch becomes the locked text "Off, locked". The checkbox still works for bulk delete. Edit is relabelled Fix. The section shows a warn banner with "Show only these"; the nav item shows icon and count; the popup shows "N rules need fixing. Open dashboard". Fix opens the normal sheet prefilled, fault summary on top, faulty fields marked, focus on the first. Save overwrites the stored entry; Cancel leaves storage untouched. Delete uses the inline confirm. A set aside proxy is never offered in a select; a select whose stored value points at one shows "Unavailable: label or id". This is the same on both browsers, Sites included.

| Kind | Row shows | Fix |
| --- | --- | --- |
| Rule | Name or "(no name)", raw patterns; faults: name missing, no match pattern, pattern N not valid, proxy not chosen, bypass or force pattern not valid, unknown resource type | Rule sheet; Exceptions opens if a fault is inside |
| Rule, static extensions only | Not set aside: "Setting ignored" badge and note; switch works; not counted | Rule sheet, Exceptions open, field marked |
| Proxy | Label or "(no label)", type, raw host and port; faults: type not supported, host empty or forbidden character, port not 1 to 65535, id missing | Proxy sheet; rules pointing at it show "Proxy unavailable" until fixed |
| Proxy, advanced field only | Not set aside: "Setting ignored" badge and "Failover timeout is not a number, so the default is used." | Proxy sheet, Advanced open, field marked |
| Website override | Raw domain key, proxy; faults: domain not valid, proxy not chosen | Override sheet; saving replaces the old key |
| Keep-alive rule | Proxy label or id; faults: no tab URL pattern, pattern N not valid, active state missing | Keep-alive sheet; missing active shows Off with "Choose on or off" |
| Keep-alive rule, test URL only | Not set aside: "Setting ignored" badge and "Test URL is not valid, so the default test URL is used." | Keep-alive sheet, field marked |

## Browser differences

Nothing vanishes without a word, driven by the existing `supportsProxyOnRequest` flag. Two labels: "Firefox only" for no effect on Chrome, "Limited on Chrome" for a narrower effect.

| Case | Items | On Chrome |
| --- | --- | --- |
| Works with a narrower effect | Sites section; popup "This site" scope; About priority tier 2 | Fully usable. Sites header carries "Limited on Chrome" and the info banner; the popup carries the "On Chrome" note naming the active domain; the override sheet uses the Chrome Domain help. |
| One option of a control | Popup "This tab" scope | Rendered `disabled`; "This site" preselected; the "On Chrome" note says per tab proxies are Firefox only. |
| A single action | Popup Test proxy; Defaults "Clear all tab proxies" | Stays, `disabled`, with the reason in words: the popup's "On Chrome" note with a link to Test in the dashboard; in Defaults the "Firefox only" badge plus "Chrome cannot set a proxy per tab." |
| A whole section with no effect | Keep-alive | Nav item carries the icon; the section opens with "Firefox only. Keep-alive rules are saved and can be edited, imported and exported here, but checks and down notices run only in Firefox." The list works normally. |
| Fields with no effect | Proxy sheet Advanced group; "Notify if down" | Editable. Advanced carries "Firefox only" and "Chrome ignores both settings." The "Notify if down" help starts with the badge. |

About tags priority tier 1 "Firefox only" and tier 2 "Limited on Chrome". Network and the popup Monitor row note "Keep DevTools open while monitoring".

The prototype has a bar above each page, marked as not part of the product, with switches for Browser (Firefox or Chrome, `data-browser` on `<html>`), List state (populated, empty, loading, error), and Theme (system, light, dark).

## Inventory mapping

| Inventory item | Where it lives |
| --- | --- |
| Popup: active tab's domain, applied proxy | "This tab" block: domain in mono, then the "Using" line |
| Popup: open dashboard; close | Header: Dashboard button, close icon button |
| Popup: proxy select; scope; set; clear | "This tab" block on both browsers; on Chrome "This tab" is disabled |
| Popup: test proxy (Firefox only) | "This tab" block; disabled on Chrome with a pointer to Test in the dashboard |
| Popup: monitor toggle | Monitor row: Switch "Monitor this tab" |
| Popup: rule toggles, active and inactive | Rules block: Segmented filter, then a scrolling list of every rule |
| General: default proxy; fallback to direct; test URL | Defaults rows 1 to 3 |
| General: clear tab proxies (Firefox only) | Defaults row 4 |
| Proxies: add, edit, remove, select | Header Add; row Edit and Delete; row checkbox and select all |
| Proxies: export selected, export all, delete selected, import | Proxies toolbar |
| Proxies: label, type, host, port, username, password | Proxy sheet; also the row |
| Proxies: notify if down | Row Switch and proxy sheet Switch, with the keep-alive dependence stated |
| Proxies: show or hide passwords, per row and all | Row "Show" button; toolbar "Show all passwords" |
| Proxies: proxy DNS, failover timeout | Proxy sheet "Advanced" Disclosure, two editable fields |
| Rules: the eight list actions | Rules header, toolbar, row actions |
| Rules: name, proxy, match patterns, active | Rule sheet "Basics"; Active is also a row Switch |
| Rules: bypass URL patterns, bypass resource types, static extensions, force proxy URL patterns | Rule sheet "Exceptions" Disclosure |
| Rules: fallback to direct | Rule sheet "If the proxy fails" |
| Website overrides: the eight list actions; domain, proxy | Sites, on both browsers; site override sheet; row |
| Keep-alive: the eight list actions; proxy, active, tab URL patterns, test proxy URL | Keep-alive; keep-alive sheet; row; Active is also a row Switch |
| Set aside entries, all four kinds | In place in each list (see Set aside entries) |
| Network: usage tree; refresh; clear; auto refresh | Network: Tree and toolbar |
| Diagnostics: test a selected proxy; edit it | Test: "Saved proxy" card |
| Diagnostics: test a custom proxy with its six fields; add it to the list | Test: Test URL field and "Custom proxy" card, "Add to list" |
| Import and export: export config, per item selection, select all, include credentials | Export card, then Export sheet |
| Import: config file, URL, GitHub repository (tree, select all, unselect all), Community Rules | Import card rows, "Choose files" where it applies, then Review |
| Import: duplicate proxy choice; keep or apply an imported default proxy, fallback or test URL | Review step |
| Rules: per row export | Rule row actions |
| Rules and keep-alive: missing proxy state | "Proxy unavailable" badge |
| Direct as a proxy choice | First option in popup, rule and override selects |
| Chrome hint that monitoring needs DevTools open | Popup Monitor row; Network banner |
| Down notices only from keep-alive, after 3 failed checks | "Notify if down" help; the "No keep-alive rule" note on the proxy row |
| Diagnostics result output and timeouts note | Test result panel, help text |
| About: name, version, rule priority, features, licence, links | About |
| Import refusal messages and the save failure message | Review step "Needs your attention"; error Banner |
| Help links for static extensions and pattern lists | Field help line |
| Exports include credentials so an import can use them | Every export; the Export sheet has "Leave out usernames and passwords", off by default, for a file meant to be shared |
| Devtools panel status line | Single status line with three states |

## How the E04 decisions are met

| Decision | How |
| --- | --- |
| Plain TypeScript, HTML, CSS; no framework, no new dependency | Native `<dialog>`, `<details>`, `<select>`, checkbox; system fonts; an in-repository SVG sprite |
| No option or action is removed | The inventory mapping. Storage mode is gone by owner decision; DNS through proxy and failover timeout gain controls; Sites gains Chrome |
| Empty, loading and error state on every page | Lists: wireframes. Network, Test, devtools: Other sections. Popup: skeleton lines while loading; "No rules yet. Open dashboard"; "Could not read this tab" or the save failure line |
| Light and dark follow the system | Colour roles defined twice, switched only by `prefers-color-scheme` |
| Every control keyboard reachable, visible focus | Native controls; rows are not click targets; one global `:focus-visible` ring; the Sheet traps and returns focus; the popup rule list scrolls with focus |
| WCAG AA contrast | Every text pair 5.5 or higher; outlines and focus ring 3.3 or higher |
| One shared set of values | `tokens.css` only |
| Usable at 360 px | Single column, top bar menu, row cards, full screen sheet, 44 px touch controls, no horizontal scroll, `overflow-wrap: anywhere` on mono values |
| State never by colour alone | Every state is icon plus words |

## Alternatives considered

Routing ladder: the dashboard's main page is the priority order (Tab, Site, Rules, Default, Direct) as stacked bands, with proxies in a side column. It teaches precedence well, but Keep-alive, Test, Network and Import still need separate navigation.

Workbench: dense list on the left, always open editor on the right, 28 px rows. Fastest for dozens of rules, but breaks at 360 px and makes first run look harder.

Dropped for breaking a constraint: an overview home page, undo after delete, an in-app theme switch, "apply to all" on import, any backup proxy affordance, an icon or web font, and a dismissible Chrome banner (it would need a new stored setting).

## Other proxy extensions (E05/S02)

### Chrome: "not in control" warning

Shown when the level of control is `controlled_by_other_extensions` or `not_controllable`. It uses existing components: the error Banner in the dashboard, the error line block in the popup. No Dismiss control: it clears by itself when the cause is gone. Nothing is shown before the first check resolves, so there is no flash on load.

Dashboard placement: the first item in the banner slot of the page frame, above any save failure or section banner, on every section. `role="alert"` when it appears. At 360 px it sits between the top bar and the section title, full width.

Popup placement: directly under the header, above "This tab", full width, `role="alert"`.

Copy, level `controlled_by_other_extensions`:

- Dashboard title: "GeoBypass is not routing your traffic"
- Dashboard body: "Another extension controls this browser's proxy settings, so your proxies, rules and site proxies are not in effect. Turn off or remove the other proxy extension on the extensions page (chrome://extensions). This message clears by itself once GeoBypass is back in control."
- Dashboard action: secondary Button "Open extensions page"
- Popup: "GeoBypass is not routing. Another extension controls proxy settings. Turn it off or remove it." followed by the quiet Button "Open extensions page"

Copy, level `not_controllable`:

- Dashboard title: "GeoBypass is not routing your traffic"
- Dashboard body: "A browser policy controls this browser's proxy settings, so your proxies, rules and site proxies are not in effect. This is usually set by your organisation or by other software on this device. GeoBypass cannot change it. Ask whoever manages this browser, or check the policy page (chrome://policy)."
- Dashboard action: none
- Popup: "GeoBypass is not routing. A browser policy controls proxy settings. GeoBypass cannot change it."

Whether an extension page may open `chrome://extensions` with `tabs.create` is unverified; if it is refused, the button is dropped and the copy carries the instruction alone.

While the warning is shown:

- Every control stays usable. Changes are saved and take effect when GeoBypass is back in control.
- The popup's "Using" line changes its prefix from "Using:" to "Saved, not in effect:". With no site proxy it still reads "No site proxy".
- In Test, both Test buttons are `disabled` and the result panel reads "Tests cannot run while GeoBypass does not control proxy settings.", since the Chrome test works by writing the PAC script.

Live behaviour: the warning is added and removed on every change of the level of control, with no reload. When it is removed, the status line in the dashboard and the popup reads "GeoBypass is routing again." If the level moves between the two causes, the copy is swapped in place. State is carried by the warning icon and the words, with `--danger` and `--danger-bg` as reinforcement only.

```
+------------------+------------------------------------------------------+
| GeoBypass        | /!\ GeoBypass is not routing your traffic            |
|                  |     Another extension controls this browser's proxy  |
| SET UP           |     settings, so your proxies, rules and site        |
| | Proxies      4 |     proxies are not in effect. Turn off or remove    |
|   Rules   12 /!\2|     the other proxy extension on the extensions page |
|   Sites        3 |     (chrome://extensions). This message clears by    |
|   Keep-alive   1 |     itself once GeoBypass is back in control.        |
|   Defaults       |     [ Open extensions page ]                         |
|                  +------------------------------------------------------+
| TOOLS            | Proxies                               [ + Add proxy ]|
|   ...            | [save failure / needs fixing / browser banners]      |

+------------------------------------------+
| GeoBypass             [Dashboard]   [x]  |
+------------------------------------------+
| /!\ GeoBypass is not routing. Another    |
|     extension controls proxy settings.   |
|     Turn it off or remove it.            |
|     [ Open extensions page ]             |
+------------------------------------------+
| THIS TAB                                 |
| video.example.com                        |
| Saved, not in effect: Tokyo SOCKS        |
|   (set for this site)                    |
| ...                                      |
```

### Firefox: standing note

An info note block (`role="note"`, info circle icon, `--surface-sunken` background, `--text-sm`). Not a Banner, always present on Firefox, no Dismiss control, not rendered on Chrome.

Placement: in Defaults, below the card as the last element of the section; in About, directly under the rule priority list.

Copy in Defaults:

- Heading: "Other proxy extensions"
- Body: "Another proxy extension can change where your requests go. Firefox does not let GeoBypass detect this. For predictable routing, run one proxy extension at a time."

Copy in About: the same heading and body, plus "Requests that no tab proxy, site proxy, rule or default proxy applies to are left untouched, so another extension may route them."
