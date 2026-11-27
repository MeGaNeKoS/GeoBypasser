---
status: done
owner: extension
---

# T02 Register background listeners before any await

Done when both backgrounds register every event and message listener synchronously when the script starts, before any `await`, and a message sent while stored config is still loading gets its answer once loading finishes instead of none. Covered by a test per background that sends a message before the stored read resolves. `npm test`, both dev builds, and both smoke tests pass.

Found while building Home: the Chrome background awaits the stored read before registering its runtime listener, so an early `getProxyControl` from a page gets no reply. A Manifest V3 service worker also misses events whose listeners are not registered at the top level of the script when it wakes.
