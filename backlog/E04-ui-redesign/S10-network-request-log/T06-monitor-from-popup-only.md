---
status: open
owner: extension
depends_on: [E04/S10/T05]
---

# T06 Monitor from the popup only, and remove the DevTools panel

The owner's decision: monitoring is switched on and off only from the popup's "Monitor this tab"; the dashboard's Network section shows the log without a list of tabs; the DevTools panel is removed. Recording already runs without DevTools in both browsers. This replaces criterion 4 of `E04/S10` and criterion 5 of `E04/S08`.

Done when:

1. The Tabs card is gone from the Network section, with its tab listeners, per tab monitored reads, and their tests. The section makes no `tabs.query` call and no per tab message, so its cost does not grow with the number of open tabs.
2. The log's empty state reads "No traffic recorded yet. Open the page you want to inspect and turn on Monitor this tab in the popup." The section still follows monitoring changes live (the broadcast stays), so a tab turned on from the popup starts showing without Refresh.
3. The DevTools panel is removed: `src/devtools.ts`, the panel page, its scripts, styles, tests, the build entries, and the `devtools_page` manifest key in both browsers. Nothing else references it.
4. The popup's Monitor row reads "Monitor this tab" with its switch and no DevTools hint, in both browsers.
5. `README.md` describes monitoring as: turn on Monitor this tab in the popup, read the log in the dashboard under Network. No mention of DevTools.
6. `npm test` and both smokes pass; the smoke turns monitoring on from the popup page for the fixture tab and reads the log rows. The Firefox "context unloaded" rejection from T05 work is fixed and stays fixed.
7. Screenshots of the Network section (empty, populated) and the popup Monitor row in both browsers, looked at.
