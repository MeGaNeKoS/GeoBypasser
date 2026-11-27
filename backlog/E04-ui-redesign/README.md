# E04 UI redesign

## Outcome

Setting up proxies, rules, website overrides, and keep-alive is quick and clear in a redesigned popup, dashboard, and devtools panel. Every option and action that exists today is still available; how the user reaches and edits it is new.

## Decisions

- The UI is plain TypeScript, HTML, and CSS, with no framework and no new dependency.
- No option or action is removed. The inventory in `S01` is the record of what exists.
- The owner approves the layout and visual direction on a prototype before any page is rebuilt.
- The design direction comes from the `ideator` agent (Fable), at the owner's request. The implementer builds the prototype and pages from its design.
- UI code is split by page and by section. No file holds more than one section's behaviour, and none exceeds 1000 lines.
- Polish is part of done, not a later pass. Every page has a designed empty state, loading state, and error state. Light and dark themes follow the system setting. Every control is reachable by keyboard and shows a visible focus state. Text meets WCAG AA contrast. Spacing, type sizes, and colours come from one shared set of values.
- Every page is checked in a real browser, Firefox and Chrome, before its story closes.
