---
status: in_progress
owner: extension
---

# T07 Review fixes for the validated config work

Done when every item below holds, each covered by a test or a smoke step that fails without the fix, and criterion 19 of `E02/S01` holds with both smoke tests.

1. Every dashboard action works on a config whose lists hold set aside entries of every shape (`null`, a string, `{}`, a partial object): edit and export on any row, export all, config export with every row selected, and every import path with a `proxyList`. No action throws, and valid entries in the same import are still imported. The smoke tests click Edit on a set aside rule and proxy row, run Export all, and import a proxy file, with that fixture in storage.
2. Code past the loader cannot treat a raw stored entry as a typed one: the load path returns its raw sections typed as unknown entries, and only the usable views carry the domain types.
3. The keep-alive form refuses a rule with no tab URL patterns, and the loader and import set it aside (see the story's "Terms").
4. A refused proxy form save marks the field at fault for every reason it can be refused, including a missing id and an unsupported type.
5. When a storage write fails, the next save of the same section writes again, and the failure reaches the user.
6. A stored rule field whose name starts with `compiled` but is not one of the extension's compiled fields survives a save.
7. A rule whose `bypassResourceTypes` is not a list of known resource type names is set aside, refused on import, and refused by the rule form.
8. Every refusal message names the entry: by its name or label when it has a non empty one, otherwise by its position in the file.
9. The background set aside tests fail when a set aside rule or proxy reaches the PAC script or the request filter, before and after a live change: each fixture has the set aside proxy referenced by a rule, and no assertion can pass through the default proxy alone. The diagnostics test exercises the diagnostics code.
10. The test files created on this branch follow the user's test file rule: one behaviour area per file, positive and negative cases in sibling files.
11. In the smoke scripts, only `main` reads arguments and the environment; the browser paths can be overridden by an environment variable; every time value is a named constant with its unit; and the removal and import assertions shared by both scripts live in one place.

12. Carried from `E02/S02/T01`: a config file import of a proxy without credentials keeps the stored credentials for that id (criterion 5 of `E02/S02` on the config import path), and Export Selected on the proxies table leaves credentials out, each covered by a smoke step in both browsers. The smoke steps for criteria 4 and 5 of `E02/S02` are shown to fail when credentials leak.

Items 11 to 19 of the review are left to `E03` and `E04`.
