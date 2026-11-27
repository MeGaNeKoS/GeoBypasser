---
status: done
owner: extension
depends_on: [E02/S01/T03]
---

# T04 Imports refuse invalid entries

Done when criteria 14 to 16 of `E02/S01` hold, criterion 11 has its import save test, and criterion 19 still holds.

The import merge lives in `src/dashboard.ts` beside DOM code, so no test can load it as it stands.
