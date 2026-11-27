---
status: done
owner: extension
---

# T01 Know when GeoBypass does not control the proxy

Done when criteria 3 and 5 of `E05/S02` hold, and the Chrome background exposes the current level of control to the popup and dashboard (on request and on every change), covered by a test of the function that turns the level into a state and a test that a change reaches the pages. `npm test`, both dev builds, and both smoke tests pass.

Not covered by an automated check: a real Chrome where another extension takes and releases proxy control; the regain path is tested against the browser mock only.

The pages that show the warning (criteria 1, 2, 4) are built in `T02` on the redesigned UI.
