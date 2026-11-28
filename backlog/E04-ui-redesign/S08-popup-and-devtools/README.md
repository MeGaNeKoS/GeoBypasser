# S08 Popup and devtools panel

As a user, the popup tells me what the current tab uses and lets me change it, flip a rule, or monitor the tab in the redesigned layout, and the devtools panel tells me plainly whether monitoring is on.

## Acceptance criteria

1. The popup is rebuilt on `src/ui/` as `design.md` describes: the header with Dashboard and close, the "This tab" block (domain, "Using" line, proxy select, scope, Set, Clear, Test proxy, result line), the Monitor row, and the Rules block with the Active and Inactive filter and a scrolling list of every rule, with loading, empty, and error states. On Android, where the popup is a full page, the list is not capped.
2. On Chrome, the popup offers "This site" only ("This tab" and Test proxy disabled), with the "On Chrome" note naming the domain, as `design.md` describes.
3. On Chrome, while another extension or a policy controls proxy settings, the popup shows the "not routing" block under the header and the "Using" line reads "Saved, not in effect:", live, as `design.md` "Other proxy extensions" describes (the popup half of `E05/S02/T02`).
4. Setting or clearing a tab or site proxy, flipping a rule, and toggling monitoring do what they did before; set aside rules are not toggled, and "N rules need fixing" opens the dashboard's Rules section filtered.
5. The devtools panel is one centred status line with its active, loading, and error states, as `design.md` describes.
6. The old popup and devtools code and styles are removed; the popup reads stored config through the usable views and runs its proxy test through the background, so no page code installs its own proxy listener (closing the exception in `E03/S01` criterion 11).
7. The designer reviews screenshots of the popup (Firefox and Chrome, populated, empty, not in control) and the devtools panel in light and dark; a reviewer walks the popup in real Firefox and Chrome for keyboard reach, focus, and page errors; their findings are fixed in this story.
8. `npm test`, both dev builds, and both smoke tests pass; the smokes set and clear a proxy from the popup and flip a rule.
