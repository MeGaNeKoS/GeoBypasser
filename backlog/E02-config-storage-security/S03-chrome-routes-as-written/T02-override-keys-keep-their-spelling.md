---
status: done
owner: extension
depends_on: [E02/S03/T01]
---

# T02 Override keys keep their stored spelling

Done when a stored website override whose key has uppercase letters is shown in the dashboard with its stored spelling, can be deleted and exported from the dashboard (which has no edit action for overrides), can be cleared from the popup, and still matches case insensitively on both browsers. Covered by a test of the dashboard's override row data, a Firefox smoke step that clears the override from the popup for a tab on that host, and by smoke steps: on Firefox, deleting and exporting a mixed case override through the dashboard; on Chrome, which has no override controls in the dashboard or the popup, finding it in the PAC script. `npm test`, both dev builds, and both smoke tests pass.

`T01` lowercases override keys in the usable view, while the dashboard deletes and exports by the key it was shown (`src/dashboard.ts`, the override remove handler and the overrides export), so a mixed case stored key cannot be deleted or exported.
