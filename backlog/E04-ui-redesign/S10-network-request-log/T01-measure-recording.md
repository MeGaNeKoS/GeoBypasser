---
status: open
owner: extension
depends_on: []
---

# T01 Measure what each browser can record

Done when these are answered by measurement in a real browser, with the numbers in the report: whether DevTools open double counts a request (Firefox and Chrome); whether Chrome's `webRequest` gives received bytes without DevTools, and how far the response `Content-Length` sum is from the DevTools sum on a few pages; whether Firefox `webRequest` events carry `proxyInfo` for a proxied request. The answers decide how criteria 1 to 3 of `E04/S10` are built.
