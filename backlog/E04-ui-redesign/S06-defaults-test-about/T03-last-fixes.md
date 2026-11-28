---
status: done
owner: extension
depends_on: [E04/S06/T02]
---

# T03 Last fixes for Defaults, Test, and About

From the designer's last look. Done when every item holds, checked in a real browser.

1. Every Test result panel icon has a `--space-2` gap to its text; the failure icon takes the danger colour. Checked in a 1280 screenshot of a failed result.
2. "GeoBypass is routing again." shows only right after the not routing warning clears, never on a plain page load or section change. Checked by loading each section fresh in Chrome.
3. The Chrome not routing banner never shows on Firefox, whatever message arrives. Checked by sending a not in control `proxyControlChanged` message in Firefox.
4. The not routing banner has `--space-4` below it.
