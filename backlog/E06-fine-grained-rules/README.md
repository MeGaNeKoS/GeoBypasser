# E06 Fine grained rules

## Outcome

A rule can be tuned so that only the connections that need a proxy use it, and everything else stays direct and fast. Every tuning option says plainly where it works.

## Decisions

- Routing on Firefox sees each request in full: its URL, its resource type, the page it belongs to, and more. Routing on Chrome goes through a PAC script, which for `https://` addresses receives only `scheme://host:port/` ("the path, query, fragment, and identity portions of the URL are stripped", Chromium `net/docs/proxy.md`, since Chrome 52, with no option to turn it off since Chrome 75). For `http://` it receives the full URL. It never receives the resource type, the page, or the method.
- So on Chrome a rule can only be tuned by host. Every option beyond the host is Firefox only, and the UI says so. On Chrome, "never proxy files matching" works only for `http://` addresses, and the UI says that too.
- Match, bypass, and force patterns match by scheme and host on both browsers; a path in a pattern is ignored (`E02/S03`).
- New tuning options added in this epic, both Firefox only: "Only proxy these resource types", the inverse of today's "Never proxy these resource types"; and "Only when the page is on", which limits a rule to requests made by pages on the listed sites.
- Options considered and left out: third party status, request method, and top level page only. They add settings without clearly keeping more traffic direct than the two above.
