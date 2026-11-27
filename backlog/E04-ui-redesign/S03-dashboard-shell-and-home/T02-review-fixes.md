---
status: done
owner: extension
depends_on: [E04/S03/T01]
---

# T02 Review fixes for the frame and Home

From the designer's review and the reviewer's walk in real browsers. Done when every item holds, each checked in a browser where it is visible, and the screenshot sets are re-captured and looked at.

## Styles

1. `src/ui/styles/base.css` loads after `tokens.css`. The old `dashboard.css` no longer sets `html, body`, `#navBar`, `#tabs`, `.nav-toggle`, or the `html, body` and `#content` rules in its 600 px block. Text uses `--font-ui` and the type scale; content padding is `--space-4` below 720 px and `--space-6` at 720 px and wider.
2. Every focusable control in the frame and Home shows the `2px solid var(--focus)` ring under keyboard focus, in both browsers: the brand link, the menu button, every Home button and link. On Firefox, `#content` is not a tab stop.

## Home

3. Loading: one bar for the status card and four plain bars in each card, with the label visually hidden; no list row shapes.
4. "Where your traffic goes" is a numbered list. Linked rows show their value in `--accent` with a chevron, and the whole row is the hover and focus target. A second line appears only when it has content.
5. The status sentence capitalises the first word after the full stop.
6. Zero values read "No sites", "No rules", "Keep-alive: no rules".
7. Card titles use the uppercase muted group label.
8. The error state keeps the "Home" title above the alert, with a `--space-2` gap between icon and text.
9. Quick actions show in the part way case as well as the set up case.
10. The status counts as routing only active rules whose proxy is usable or, failing that, can fall back to a usable default proxy; "Routing is on" is not shown when no rule, site, or default proxy can route.

## Frame

11. At 360 px the top bar button is a menu icon, the label, and a chevron icon at the right edge, and carries `aria-expanded` in step with the menu.

## Sections not yet rebuilt (interim, in one marked block of `assets/dashboard.css`)

12. Each legacy table sits in a container with `overflow-x: auto`, `tabindex="0"`, and an accessible name, so it scrolls inside itself and the page never scrolls sideways.
13. Buttons inside table cells are exempt from the old 600 px full width button rule.
14. The old hard coded colours for `.modal-content`, `tr.missing-proxy`, and `tr.invalid-*` map to `--surface`, `--danger-bg`, and `--warn-bg`; "Add rule" opened in the light theme is readable.

Accepted as interim until the sections are rebuilt: set aside links on Home open their section unfiltered; on Chrome the Sites row has no link.
