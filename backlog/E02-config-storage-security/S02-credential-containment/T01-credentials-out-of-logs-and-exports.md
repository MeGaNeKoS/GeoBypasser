---
status: done
owner: extension
---

# T01 Credentials out of logs, exports, and other servers

Done when criteria 1 to 5 and 8 of `E02/S02` hold.

Today the Firefox background logs the whole config at startup and every storage change, both backgrounds log the username on each auth challenge, and auth matches on host, port, and type without checking that the challenge came from a proxy.
