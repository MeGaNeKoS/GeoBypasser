---
status: done
owner: extension
---

# T03 Loading and saving keep stored config sound

Done when criteria 1 to 13, 18, and 19 of `E02/S01` hold. The import save test that criterion 11 asks for belongs to `T04`. Criterion 1 for the Firefox pages belongs to `T06`; this task covers both backgrounds by test and the Chrome pages by `npm run smoke:chrome`.

Firefox routes with `proxy.onRequest` and Chrome with a generated PAC script, so each criterion that says "on each browser path" needs a test on both.

Every write path saves a whole section from its in memory copy of the config: the dashboard forms, the popup, and every import. A set aside entry survives only if all of them carry it through, which is why criterion 11 belongs to this task and not to the import or form tasks.

The one definition of valid that this task introduces is what `T04` and `T05` build on.
