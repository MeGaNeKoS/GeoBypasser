# S03 Dashboard shell and Home

As a user opening the dashboard, I land on Home, which tells me whether my traffic is being routed and what to do next, and I can reach every section from one navigation that works with a mouse, a keyboard, and at phone width.

## Acceptance criteria

1. The dashboard page is rebuilt on `src/ui/`: sidebar at 720 px and wider, top bar with section menu below, sections addressed by URL hash, Home first and the landing section, as `design.md` describes. Sections not yet rebuilt in later stories open the existing section content inside the new frame, so nothing the user can do today is lost.
2. Home matches `design.md` "Home": the three cases (first time, part way, set up), the status card, quick actions, "Where your traffic goes", the Proxies card, "Get started", and the loading and error states, built from stored config, the tab proxy map, and the proxy control state through the usable views. No new setting or stored value.
3. Every Home count and link is right for a config with set aside entries of every kind, on both browsers. Covered by tests of the function that turns config into Home's content.
4. The page reads stored config only through the usable views.
5. The designer reviews screenshots of Home and the frame in both browsers, light and dark, at 1280 and 360 px, and a reviewer walks it in real Firefox and Chrome for keyboard reach, focus, and page errors; their findings are fixed in this story.
6. `npm test`, both dev builds, and both smoke tests pass; the smoke tests open Home in its first time and set up cases.
