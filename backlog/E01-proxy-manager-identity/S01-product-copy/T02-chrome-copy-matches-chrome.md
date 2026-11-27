---
status: done
owner: extension
---

# T02 Chrome copy claims only what Chrome does

Done when the Chrome manifest description and the About text on Chrome name only features that work on Chrome, the Firefox manifest description keeps its sentence, the wording check of `E01/S01` criterion 2 still returns nothing, and `npm test` and both dev builds pass.

Criterion 1 of `E01/S01` required one sentence for both manifests, and that sentence claims routing by tab, which Chrome does not support. Criterion 1 now allows one accurate sentence per browser.
