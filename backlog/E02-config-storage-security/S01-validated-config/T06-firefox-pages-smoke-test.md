---
status: done
owner: extension
depends_on: [E02/S01/T03]
---

# T06 Firefox pages smoke test

Done when a script smoke tests the Firefox dev build in a real Firefox and exits non zero on failure, covering what the Chrome smoke script covers: a stored config with set aside entries of every kind, the dashboard and the popup opened, every dashboard tab visited, one set aside rule and one set aside proxy removed through the dashboard, and no uncaught exception or unhandled rejection in any page or in the background.

Criterion 1 of `E02/S01` names Firefox, and several parts of the UI exist only there: tab proxies, website overrides, keep-alive. The Chrome smoke test from `T03` does not run them.

The script adds no dependency and uses a throwaway profile, never the user's own.
