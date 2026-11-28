# S05 Sites and Keep-alive sections

As a user, I manage per site proxies and keep-alive rules in the redesigned sections, with the same list, sheet, set aside, and focus behaviour as Proxies and Rules, and I can see plainly what each does on Chrome.

## Acceptance criteria

1. The Sites and Keep-alive sections are rebuilt on `src/ui/` as `design.md` describes, reusing the list and sheet patterns from `E04/S04`: rows, toolbar, selection, inline delete confirm, set aside rows with Fix and "Show only these", the site sheet and the keep-alive sheet, with empty, loading, and error states.
2. Every action the old sections offered still works: add, edit, delete, select, export selected, export all, delete selected, import, the keep-alive active switch.
3. Sites is shown and usable on Chrome with the "Limited on Chrome" badge, the info banner, and the Chrome domain help, as `design.md` describes; Keep-alive on Chrome carries the "Firefox only" treatment. Home's Sites row on Chrome links to the section.
4. Set aside site overrides and keep-alive rules are shown with their reasons, as for proxies and rules; `pageView` returns them with a flag. Home's set aside links to Sites and Keep-alive open the section with "Show only these" on.
5. Saves keep every stored field the form does not show and refuse invalid entries with the field marked, as `E02/S01` requires.
6. Focus is kept across storage re-renders, sheet returns, and deletes, as `E04/S04` criterion 8 and its review fixes require.
7. The old Sites and Keep-alive code leaves `src/dashboard.ts`, and their interim styles leave `assets/dashboard.css`.
8. The designer reviews screenshots of both sections and both sheets in both browsers, light and dark, at 1280 and the narrowest width; a reviewer walks them in real Firefox and Chrome for keyboard reach, focus, and page errors; their findings are fixed in this story.
9. `npm test`, both dev builds, and both smoke tests pass, and the smoke tests add, edit, and delete a site and a keep-alive rule through the new sections.
