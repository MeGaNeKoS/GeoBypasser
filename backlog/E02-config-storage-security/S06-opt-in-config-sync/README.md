# S06 Remove the dormant cloud storage mode

As a user, my config lives only in this browser's local storage, and nothing in the extension can write it, or my proxy credentials, to browser sync.

Config sync was dropped: making it safe across devices editing at the same time costs more than it is worth, and export and import already move config between devices. Before this story a cloud storage mode exists in the code, unreachable from the UI, that reads and writes the whole config, passwords included, to `storage.sync` when a `storageMode` flag is `cloud`.

## Acceptance criteria

1. No code in `src/` reads from or writes to `storage.sync`, and no code reads the `storageMode` flag to choose a storage area. A test fails if either appears in the source.
2. A device whose local storage holds `storageMode: 'cloud'` from an old build loads its config from local storage and routes with it, on both browsers. Loading does not delete or change the flag or any config key. Covered by a test.
3. The commented out storage mode control is gone from the dashboard markup and code.
4. The `StorageMode` type, its schema, and the `STORAGE_MODE` key constant are gone, along with every test that only exercised them.
5. `npm test`, both dev builds, `npm run smoke:chrome`, and `npm run smoke:firefox` pass.
