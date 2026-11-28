# S09 Release 2.0.0

As the owner, I can ship the redesign as version 2.0.0 from `cleanup/proxy-manager` once I merge it.

## Acceptance criteria

1. Both manifests and `package.json` read version 2.0.0.
2. `README.md` describes the extension as it is now: the redesigned dashboard sections and popup, the per browser differences, the import review step, and how to build, test, and run the smoke tests. No screenshot or text describes the old UI.
3. `npm run build:prod:chrome` and `npm run build:prod:firefox` produce builds that contain no component test page and no prototype files, and both load in a real browser with every dashboard section, the popup, and the devtools panel opening without a page error.
4. `npm test`, both dev builds, and both smoke tests pass on the release commit.
5. Nothing is uploaded to a store and `master` is not touched; both stay with the owner.
