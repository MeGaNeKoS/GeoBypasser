# S06 Defaults, Test, and About sections

As a user, I set my defaults, test a proxy, and read about the extension in the redesigned sections, and on Firefox I'm told plainly that other proxy extensions can change where requests go.

## Acceptance criteria

1. Defaults, Test, and About are rebuilt on `src/ui/` as `design.md` describes, with their loading and error states. Defaults is one card whose controls save on change; "Clear all tab proxies" uses the inline confirm and is disabled with its reason on Chrome. Test has the saved proxy and custom proxy cards, the result panel in all its states, and "Add to list" opening the proxy sheet prefilled. About has the per browser description, the numbered rule priority with its browser badges, the features, licence, and links.
2. The default proxy select offers "None" then usable proxies, and shows a stored set aside or missing default proxy as `design.md` "Set aside entries" describes.
3. The Firefox "Other proxy extensions" note sits in Defaults and About as `design.md` describes (`E05/S02` criterion 4).
4. On Chrome, while another extension or a policy controls proxy settings, the Test buttons are disabled with the designed reason line.
5. Every action the old sections offered still works; the old Defaults (General), Diagnostics, and About code leaves `src/dashboard.ts`, `assets/dashboard.html`, and `assets/dashboard.css`.
6. Focus is kept across storage re-renders and sheet returns, as in `E04/S04`.
7. The designer reviews screenshots of the three sections in both browsers, light and dark, at 1280 and the narrowest width; a reviewer walks them in real Firefox and Chrome; their findings are fixed in this story.
8. `npm test`, both dev builds, and both smoke tests pass; the smokes change a default, run a test against a local proxy, and read About.
