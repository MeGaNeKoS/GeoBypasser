# S02 Shared UI foundation in the extension

As the maintainer, I build the redesigned pages from one set of design tokens and components shipped with the extension, so every page looks and behaves the same.

## Acceptance criteria

1. The tokens, base styles, icon sprite, and components the prototype proved (button, switch, segmented control, field, badge, banner, note, list section, row, sheet, disclosure, pattern list, type grid, tree, state blocks, status line) live under `src/ui/`, are bundled with the extension, and are the only source of colours, sizes, and fonts for the pages.
2. Each component's behaviour is checked in real Firefox and Chrome on a component test page in the dev build: keyboard handling, `aria` attributes, states, and the sheet's focus trap, Escape, and discard prompt. No new test dependency is added for a DOM.
3. Every component renders in both browsers with no page error on that test page, checked by the smoke tests. The test page is not part of a packaged (production) build.
4. Light and dark themes follow the system setting; every interactive component shows the `--focus` ring under keyboard focus, checked in both browsers.
5. The prototype keeps working, built from the same `src/ui/` components, so it stays a faithful preview of the pages.
6. `npm test`, both dev builds, `npm run build:prototype`, `npm run smoke:chrome`, and `npm run smoke:firefox` pass.
