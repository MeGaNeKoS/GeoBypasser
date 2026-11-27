# S01 Tune a rule beyond its host

As a user on Firefox, I can limit a rule to the kinds of requests that need the proxy, such as only video and API calls, or only requests made while I am on one site, so the rest of the traffic to that host stays direct. As a user on Chrome, I am told which of these options cannot apply there.

## Acceptance criteria

1. A rule's resource types can be set to "Never proxy these" (today's behaviour) or "Only proxy these", with the same 21 types. With "Only proxy these", a matching request of another type connects directly. Stored as a new optional field; a rule without it behaves exactly as before. Covered by tests on the Firefox path.
2. A rule can list "Only when the page is on" hostnames, in the same form as keep-alive tab hostnames. With a list, a matching request is proxied only when the page it belongs to is on a listed host or a subdomain; otherwise it connects directly. A request with no page (no `documentUrl` or `tabId` of -1) connects directly. Stored as a new optional field; a rule without it behaves exactly as before. Covered by tests on the Firefox path, including a missing `documentUrl`.
2a. "Only proxy these" with no type ticked is not in use: the rule proxies every type. "Always proxy these hosts" (force patterns) wins over both new limits, as it already wins over never proxy hosts and files matching. Covered by tests.
3. Both new fields follow `E02/S01`: invalid values set the rule aside or are refused on import and in the form, exports carry them, and older versions that do not know them keep them on save.
4. On Chrome, the PAC script ignores both new fields and resource types; a rule with them routes by host alone. Covered by the route agreement table, which marks those rows Firefox only.
5. On Chrome, "never proxy files matching" applies to `http://` requests only. The PAC script no longer emits a check that can never match an `https://` request. Covered by a test that evaluates the PAC script for both schemes.
6. `npm test`, both dev builds, and both smoke tests pass.

The rule editor's controls and wording for these options come from the redesign (`E04`), designed by `ui-redesign`.
