# S04 Proxies and Rules sections

As a user, I add, edit, fix, toggle, import, export, and delete proxies and rules in the redesigned sections, and I can fine tune any rule without the editor getting in my way when I don't.

## Acceptance criteria

1. The Proxies and Rules sections are rebuilt on `src/ui/` as `design.md` describes: list pattern, rows, toolbar, selection, inline delete confirm, set aside rows with Fix, "Show only these", the proxy sheet with its Advanced group (DNS through proxy, failover timeout), and the rule sheet with Basics and "Fine tuning" (`E06/S01` options included), with their empty, loading, and error states.
2. Every action the old sections offered still works: add, edit, delete, select, export selected, export all, delete selected, import, show and hide passwords, notify if down, rule active toggle, per rule export.
3. Saves keep every stored field the form does not show, and refuse invalid entries with the field marked, as `E02/S01` requires; the rule sheet refuses invalid values in the `E06/S01` fields.
4. The failover timeout is applied by the routing code when set (the bug that ignores it is fixed), on Firefox; covered by a test.
4a. A rule whose only fault is its static extensions value shows "Setting ignored" and is not counted as set aside, as `design.md` "Set aside entries" says. This supersedes `E02/S01` criterion 10, which showed such a rule as invalid.
5. Home's set aside links to Proxies and Rules open the section with "Show only these" on.
6. The old Proxies and Rules render code leaves `src/dashboard.ts`, and their interim styles leave `assets/dashboard.css`.
7. The designer reviews screenshots of both sections and both sheets in both browsers, light and dark, at 1280 and 360 px; a reviewer walks them in real Firefox and Chrome for keyboard reach, focus, and page errors; their findings are fixed in this story.
8. A storage change that re-renders a section while its heading or a control has focus keeps focus on the same control or its replacement.
9. `npm test`, both dev builds, and both smoke tests pass, and the smoke tests add, edit, and delete a proxy and a rule through the new sections.
