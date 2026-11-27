# S04 Network statistics hold only their own data

As a user monitoring a tab, a page cannot change how the extension behaves by choosing the paths and hosts it requests.

Before this story the network statistics tree is built from plain objects keyed by host and path segment, so a request to `https://host/__proto__/` writes `sent` and `received` onto `Object.prototype` in the background.

## Acceptance criteria

1. Requests whose host or path segments are `__proto__`, `constructor`, `prototype`, `hasOwnProperty`, or `toString` are counted under those names like any other segment, and after them `({}).sent` and `({}).received` are `undefined` and `Object.prototype` has no new own property. Covered by a test on the statistics module.
2. The statistics tree sent to the dashboard and devtools has the same shape as before, and the dashboard's Network section shows those names as text. One exception: between the Firefox background and the dashboard, keys that are names of `Object.prototype` members (`__proto__`, `constructor`, `toString`, `valueOf`, `hasOwnProperty`, and the like) are dropped with their subtree, though the background counts them. The same names never reached the background tree before this story. Ordinary names arrive intact on Firefox. Covered by a test of the tree and a smoke step in both browsers: Chrome shows the prototype names; Firefox shows the host and an ordinary path under it.
3. `npm test`, both dev builds, `npm run smoke:chrome`, and `npm run smoke:firefox` pass.
