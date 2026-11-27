# S01 Design prototype

As the owner, I click through the proposed popup, dashboard, and devtools panel before any page is rebuilt, and decide whether this is the layout and look to build.

## Acceptance criteria

1. A static prototype of the popup, the dashboard, and the devtools panel opens from disk in Firefox and in Chrome. It uses sample data and no extension API.
2. The inventory below has been checked against the current pages, and anything missing from it has been added.
3. Every item in the inventory is reachable in the prototype.
4. The prototype shows how items that work only on Firefox appear on Chrome.
5. The dashboard prototype is usable at 360 px width, since the Firefox build is tested on Android.
6. The owner has reviewed the prototype and recorded in this story either approval or the changes wanted. The decision to make: is this the layout and visual direction to build.

Owner review, 2026-11-28: approved as the starting point ("good enough for me", "current design I think already a good starting point"), with one addition: a welcome or home page. The owner's bar for the build: simple enough, yet with advanced tuning available, and properly designed with nothing broken.

## Inventory

### Popup

- Active tab's domain and the proxy applied to it
- Open dashboard; close
- Proxy select; scope select (tab or site); set; clear
- Test proxy (Firefox only)
- Monitor toggle for the active tab
- Rule toggles, split into active and inactive

### Dashboard: General

- Default proxy; fallback to direct; test proxy URL
- Clear tab proxies (Firefox only)
- No storage mode control: config sync was dropped in `E02/S06`, so the design's Storage slot is removed

### Dashboard: Proxy list

- Add, edit, remove, select; export selected, export all, delete selected, import
- Fields: label, type, host, port, username, password, notify if down
- Show or hide passwords, per row and for all rows
- In the config format with no control today: proxy DNS, failover timeout

### Dashboard: Rules

- Add, edit, remove, select; export selected, export all, delete selected, import
- Fields: name, match patterns, proxy, bypass URL patterns, bypass resource types, static extensions, force proxy URL patterns, fallback to direct, active

### Dashboard: Website overrides (Firefox only)

- Add, edit, remove, select; export selected, export all, delete selected, import
- Fields: domain, proxy

### Dashboard: Keep-alive (runs on Firefox only)

- Add, edit, remove, select; export selected, export all, delete selected, import
- Fields: proxy, active, tab URL patterns, test proxy URL

### Dashboard: set aside entries

- A rule, proxy, website override, or keep-alive rule that is set aside (see `E02/S01`) is shown as invalid and can be edited or deleted
- Today only rules and proxies are shown this way; set aside overrides and keep-alive rules stay in storage but are hidden

### Dashboard: Network

- Usage tree; refresh; clear; auto refresh toggle

### Dashboard: Diagnostics

- Test a selected proxy; edit the selected proxy
- Test a custom proxy: test URL, type, host, port, username, password
- Add the custom proxy to the list

### Dashboard: Import and export

- Export config with per item selection and select all
- Import a config file
- Import from a URL
- Import from a GitHub repository: file tree, select all, unselect all
- Community Rules

### Dashboard: About

- Name, version, rule priority, features

### Devtools panel

- Status line; no controls
