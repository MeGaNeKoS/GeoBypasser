# Proposed design: "Quiet console"

Produced by the `ideator` agent (Fable) for `E04/S01`. Not yet reviewed by the owner. Nothing here is rendered; layout, 360 px behaviour and focus order are intent until the prototype runs. Contrast ratios were computed with the WCAG formula.

## Open decisions for the owner

1. Proxy DNS and failover timeout: shown read only in the proxy editor, since a control would be a new setting.
2. Website overrides on Chrome: recommended visible and editable with a "no effect in this browser" banner, as Keep-alive behaves today. Fallback: a notice only page.
3. Three small behaviour changes, each can be vetoed: Delete gets an inline confirm (today immediate); `alert()` messages become inline banners; the password field is masked with a Show button.
4. Popup rule list keeps its cap of 5 with a "Showing 5 of 12. All rules" link, or becomes a scrolling full list.
5. Import gets a single Review step before saving (refused entries and duplicate choices in one sheet). Fallback: today's sequence rendered inside the sheet.

Notes for the build: set aside overrides and keep-alive rules are not reachable by the page today (`src/utils/pageView.ts`, `overrideRows` and `keepAliveRows` read usable entries only); the design needs every row with an invalid flag and its faults. `src/utils/proxy.ts` reads `proxy.failoverTimeout || (...) ? 30 : 3`, so a stored timeout is never used; the read only line must say "stored value".

## Framing

Popup job: "what is this tab using, change it, flip a rule". Dashboard job: "add a proxy, point traffic at it, find out why something is not working". So: one list pattern for the four collections, one editor pattern (a side sheet) with advanced fields folded but never hidden, one status language (icon plus words).

## Information architecture

Nine sections, addressed by URL hash (`#proxies`, `#rules`, ...). Landing section is Proxies.

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

- Popup Dashboard button opens the dashboard; "N rules need fixing" opens `#rules` filtered.
- Sidebar at 720 px and wider; below, a top bar whose section button opens a full width menu.
- Every add, edit or fix opens a Sheet (native `<dialog>`, `showModal()`): right panel 480 px when wide, full screen below 720 px.
- No dialog on dialog: the pattern list, resource type and duplicate modals become inline parts of the sheet.
- All import sources converge on one Review step.

## Design tokens

One `tokens.css` loaded by all three pages; no other file contains a raw colour, pixel size or font size.

Spacing (4 px base): `--space-1` 4, `--space-2` 8, `--space-3` 12, `--space-4` 16, `--space-5` 24, `--space-6` 32, `--space-7` 48.

Type: `--font-ui` `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`; `--font-mono` `ui-monospace, "Cascadia Mono", Consolas, Menlo, monospace` for hosts, ports, domains, patterns, paths. Weights 400 and 600.

| Token | Size / line height | Use |
| --- | --- | --- |
| `--text-xs` | 12 / 16 | badges, group labels (uppercase, 0.04em) |
| `--text-sm` | 13 / 18 | help text, meta |
| `--text-md` | 14 / 20 | body, controls |
| `--text-lg` | 16 / 24 | sheet title, popup domain |
| `--text-xl` | 20 / 28 | section title |

Under `pointer: coarse`, inputs and selects use 16 px.

Shape: `--radius-1` 4, `--radius-2` 8, `--radius-pill` 999. `--control-h` 32 (44 coarse), `--row-min-h` 44 (56 coarse). 1 px borders; `--shadow-overlay` on sheet and nav menu only. `--sidebar-w` 216, `--content-max` 960, `--sheet-w` 480, `--popup-w` 360. One breakpoint `--bp-wide` 720 px. Motion `--dur` 120 ms ease-out, 0 under `prefers-reduced-motion`.

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
| Segmented | Radio group drawn as joined buttons: popup scope, proxy type, popup rule filter, duplicate choice. |
| Field | Label, control, help, error. Error is icon plus text in `--danger`, `aria-describedby`; control gets `aria-invalid` and a 2 px danger border. |
| Select, Checkbox | Native, styled with tokens. |
| Badge | Pill with icon and text: `invalid` "Not used", `ignored` "Setting ignored", `unavailable` "Proxy unavailable", `firefox` "Firefox only", `count`. |
| Banner | Strip with icon, text, optional action. Error `role="alert"`, others `role="status"`. |
| ListSection | Header, toolbar, optional banner, rows. Shared by Proxies, Rules, Sites, Keep-alive. |
| Row | `<li>` on CSS grid; stacked card below 720 px. |
| Sheet | `<dialog>` with title bar, scrolling body, sticky footer Save and Cancel. Esc closes, focus returns. Dirty form asks "Discard changes? [Discard] [Keep editing]". |
| PatternList | Edits a string list in place: mono input plus Remove per row, "Add pattern", per row validation, help link. |
| TypeGrid | Checkbox grid (2 columns narrow, 3 wide) for the 21 resource types. |
| Tree | Nested `<details>`, for network usage and the GitHub file tree. |
| Status line | Polite `aria-live` region for "Saved", test results, counts. |

Icons: about 14 inline SVG symbols in one sprite in the repository, each with text or an `aria-label`.

## Shared list pattern

- Header: title, one line of help, primary Add.
- Toolbar: select all, Import, Export all. With a selection: "N selected", Export selected, Delete selected. Proxies also has "Show all passwords".
- Row actions are visible text buttons: Edit, Delete, and Export on rules. No overflow menus.
- Delete: row actions replaced in place by "Delete this proxy? [Delete] [Cancel]", focus on Cancel.
- Inline toggles (rule Active, keep-alive Active, proxy Notify) save at once; status line says "Saved".
- Save failure: error Banner pinned at the top with Dismiss; in the popup an error line under the header.

## Other sections

Defaults: one card, 480 px max. Default proxy (None plus usable proxies); "If a proxy fails, connect directly" switch; Test URL (http or https); "Clear all tab proxies" with inline confirm (Firefox only); a Storage slot for Local or Cloud, unrendered until sync lands.

Test: Test URL prefilled from Defaults. "Saved proxy" card: select, Test, Edit. "Custom proxy" card: Type, Host, Port, Username, Password (masked, Show), Test, "Add to list". Result panel: idle "No test run yet", busy "Testing…", success "Connected through host:port", failed "Failed: reason".

Network: Refresh, Clear (inline confirm), "Auto refresh" switch (5 s). Tree rows with Sent and Received right aligned; below 720 px they drop under the name. Empty: "No traffic recorded yet. Turn on Monitor for a tab from the popup." Loading: 4 skeleton rows. Error: "Could not read usage from the extension. [Retry]".

Import and export: Export card opens the Export sheet (four groups with per group Select all, "Select entire config", "Include proxy usernames and passwords" off by default). Import card: From a file, From a URL, Community rules.

About: name and version, description, rule priority (tiers 1 and 2 badged Firefox only), features, licence, links.

Devtools panel: one centred line. Active "Network monitoring is on for this tab while DevTools is open. See usage in the dashboard under Network." Loading "Connecting to the extension…". Error "Not connected to the extension. Close and reopen DevTools."

Proxy sheet: Label; Type (HTTP or SOCKS5); Host and Port (mono, side by side when wide); Username; Password (masked, Show); "Notify if down"; read only "From the config file": DNS through proxy, failover timeout stored value. Editing preserves both.

Site override sheet: Domain (mono; "All sites ending with this domain use the chosen proxy"), Proxy (including Direct).

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
| RULES       [ Active 3 | Inactive 9 ]    |
| (  o) On   Streaming JP                  |
| (  o) On   News UK                       |
| (  o) On   Music US                      |
| /!\ 2 rules need fixing. Open dashboard  |
+------------------------------------------+
```

Popup, Chrome:

```
+------------------------------------------+
| GeoBypass             [Dashboard]   [x]  |
+------------------------------------------+
| THIS TAB                                 |
| video.example.com                        |
| (i) Firefox only: choosing a proxy for   |
|     one tab or one site. Here, traffic   |
|     follows your rules and the default   |
|     proxy.                               |
+------------------------------------------+
| Monitor this tab              (o  ) Off  |
| (i) Keep DevTools open while monitoring. |
+------------------------------------------+
| RULES       [ Active 3 | Inactive 9 ]    |
| ...                                      |
+------------------------------------------+
```

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

Selected nav item: 3 px accent bar, sunken background, 600 weight, `aria-current="page"`. "/!\2" has the accessible name "2 need fixing".

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
|     Notify if down (o  ) Off                           [Edit] [Delete]  |
+-------------------------------------------------------------------------+
|/!\ [ ] (no label)  SOCKS5  proxy host:(missing)    [ Not used ]         |
|     Host contains a space. Port is missing.            [Fix]  [Delete]  |
+-------------------------------------------------------------------------+
```

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

Save is always enabled; pressing it validates, shows the summary, and moves focus to the first faulty field. Exceptions is collapsed for a new rule ("None in use") and opens itself when any of its fields has a value or a fault.

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

Step "Review" (every source)
| Review import                            [x] |
| TO ADD                                       |
|   4 rules, 1 proxy, 2 keep-alive rules       |
| REFUSED (2)                                  |
|   /!\ Rule "Old": match pattern not valid    |
|   /!\ Proxy 3: a field is missing            |
| ALREADY IN YOUR LIST (1)                     |
|   203.0.113.7:1080                           |
|   [ Keep existing | Use new | Keep both ]    |
| [ Import ]  [ Cancel ]                       |
  after Import: sheet closes, status "Imported 4 rules, 1 proxy,
  2 keep-alive rules", focus returns to the opener. Bad JSON or HTTP
  failure shows in the sheet body with [ Choose another ] [ Cancel ].
```

## Set aside entries

Shown in the entry's normal list: warning icon in the gutter, 3 px `--warn` stripe, "Not used" badge, and a reason line with one sentence per fault. Unreadable values shown raw in mono, absent ones as "(missing)". A set aside rule's switch becomes the locked text "Off, locked". The checkbox still works for bulk delete. Edit is relabelled Fix. The section shows a warn banner with "Show only these"; the nav item shows icon and count; the popup shows "N rules need fixing. Open dashboard". Fix opens the normal sheet prefilled, fault summary on top, faulty fields marked, focus on the first. Save overwrites the stored entry; Cancel leaves storage untouched. A set aside proxy is never offered in a select; a select whose stored value points at one shows "Unavailable: label or id".

| Kind | Row shows | Fix |
| --- | --- | --- |
| Rule | Name or "(no name)", raw patterns, faults: name missing, no match pattern, pattern N not valid, proxy not chosen, bypass or force pattern not valid, unknown resource type | Rule sheet; Exceptions opens if a fault is inside |
| Rule, static extensions only | Not set aside: "Setting ignored" badge and note; switch works; not counted | Rule sheet, Exceptions open, field marked |
| Proxy | Label or "(no label)", type, raw host and port; faults: type not supported, host empty or forbidden character, port not 1 to 65535, id missing | Proxy sheet; rules pointing at it show "Proxy unavailable" until fixed |
| Website override | Raw domain key, proxy; faults: domain not valid, proxy not chosen | Override sheet; saving replaces the old key |
| Keep-alive rule | Proxy label or id; faults: no tab URL pattern, pattern N not valid, active state missing | Keep-alive sheet; missing active shows Off with "Choose on or off" |

## Firefox only features on Chrome

Nothing vanishes without a word, driven by the existing `supportsProxyOnRequest` flag.

| Case | Items | On Chrome |
| --- | --- | --- |
| A group of controls with no effect | Popup applied proxy line, proxy select, scope, Set, Clear, Test proxy | Block replaced by one "Firefox only" info note |
| A single action | Defaults: Clear all tab proxies | Row stays, button disabled, "Firefox only" badge, "Chrome cannot set a proxy per tab." |
| A whole section | Sites; Keep-alive | Nav item badged; section opens with "Firefox only. These are saved and can be edited, imported and exported here, but have no effect in Chrome." List works normally |

About tags priority tiers 1 and 2. Network and the popup Monitor row note "Keep DevTools open while monitoring".

The prototype has a bar above each page, marked as not part of the product, with switches for Browser (Firefox or Chrome, `data-browser` on `<html>`), List state (populated, empty, loading, error), and Theme (system, light, dark).

## Items found missing from the inventory

| Item | Where it lives |
| --- | --- |
| "Include proxy usernames and passwords" on config export | Export sheet |
| Per group Select all in config export | Export sheet group headers |
| Duplicate proxy choice on import: Keep existing, Use new, Keep both | Import Review step |
| Per row Export on rules | Rule row actions |
| "Missing proxy" state on rules and keep-alive | "Proxy unavailable" badge |
| Direct as a proxy choice | First option in popup, rule and override selects |
| Chrome hint that monitoring needs DevTools open | Popup Monitor row; Network banner |
| Popup rule list capped at 5 | Kept with "Showing 5 of N. All rules" |
| Diagnostics result output and timeouts note | Test result panel, help text |
| About licence and links | About |
| Import refusal messages and the save failure alert | Review step "Refused"; error Banner |
| Help link for static extensions and pattern lists | Field help line |
| Section export of proxies always omits credentials | Toolbar help: "Exports here leave out usernames and passwords. Use Import and export to include them." |

## Alternatives considered

Routing ladder: the dashboard's main page is the priority order (Tab, Site, Rules, Default, Direct) as stacked bands with proxies in a side column. Teaches precedence well, but two of five bands are dead on Chrome, and Keep-alive, Test, Network and Import still need a second navigation.

Workbench: dense list on the left, always open editor on the right, 28 px rows. Fastest for dozens of rules, but breaks at 360 px and makes first run look harder.

Dropped for breaking a constraint: an overview home page, undo after delete, an in-app theme switch, "apply to all duplicates", editable Proxy DNS and failover timeout, any backup proxy affordance, an icon or web font.
