---
status: done
owner: extension
---

# T03 Exports carry credentials

Done when criterion 4 of `E02/S02` holds as rewritten, criterion 5 still holds, and `npm test`, both dev builds, and both smoke tests pass. The smoke credential steps check that Export All, Export Selected, and the config export include credentials, and that the config export with "Leave out usernames and passwords" turned on omits them.

The owner decided that an export must be usable when imported, so the earlier default of leaving credentials out is reversed.
