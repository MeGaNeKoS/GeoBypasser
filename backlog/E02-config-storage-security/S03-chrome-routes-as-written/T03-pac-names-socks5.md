---
status: done
owner: extension
---

# T03 PAC script names SOCKS proxies as SOCKS5

Done when the Chrome PAC script and the Chrome proxy test route a proxy of type `socks` with the PAC keyword Chrome reads as SOCKS version 5, confirmed against Chromium's PAC documentation and quoted in the report, with a test on the generated script. `npm test`, both dev builds, and both smoke tests pass.

The UI names this type SOCKS5. `src/utils/pac.ts` and `src/utils/proxy.ts` write `SOCKS host:port`, which Chromium documents as SOCKS version 4: its `net/docs/proxy.md` gives `SOCKS proxy:8080` as a SOCKSv4 example and `SOCKS5 proxy:8080` as the SOCKSv5 identifier.
