---
status: open
owner: extension
depends_on: [E02/S03/T01]
---

# T02 Override keys keep their stored spelling

Done when a stored website override whose key has uppercase letters is shown in the dashboard with its stored spelling, can be edited, deleted, and exported from the dashboard, and still matches case insensitively on both browsers. Covered by a test of the dashboard's override row data and by a smoke step in both browsers that deletes a mixed case override and checks storage no longer holds it. `npm test`, both dev builds, and both smoke tests pass.

`T01` lowercases override keys in the usable view, while the dashboard deletes and exports by the key it was shown (`src/dashboard.ts`, the override remove handler and the overrides export), so a mixed case stored key cannot be deleted or exported.
