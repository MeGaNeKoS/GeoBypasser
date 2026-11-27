# S03 Chrome routes exactly what a rule says

As a Chrome user, a rule sends through its proxy exactly the requests it names, the same requests it would on Firefox, and nothing else.

Before this story the Chrome PAC script passes raw match patterns to `shExpMatch`, which treats them as loose globs, so `*://*.example.com/*` also matches `http://evil.com/x.example.com/y`. Its force and bypass lines run before, and apart from, the rule's own match. Website overrides match any host that ends with the domain text, so `example.com` also matches `notexample.com`. Static extensions are never applied.

## Acceptance criteria

1. One table of rules and URLs is run through the Firefox request handler and through the generated Chrome PAC script, evaluated in a test. Both give the same route for every row. Rows include a host spoof such as `http://evil.com/x.example.com/y`, a scheme the pattern excludes, a port, a pattern with a path, a subdomain, a force pattern, a bypass pattern, and a static extension.
2. A rule's force and bypass patterns apply only to URLs its match patterns cover, on both browsers. A bypassed request connects directly, even when a default proxy is set.
2a. Patterns match by scheme and host; the path in a pattern is ignored on both browsers, as on Firefox today. Shared rule files depend on this: the community Crunchyroll rule bypasses `*://static.crunchyroll.com/`, meaning the whole host. Table rows show a pattern with a path matching other paths on that host on both browsers.
3. A website override for `example.com` matches the host `example.com` and any subdomain of it, and no other host, including `notexample.com`. On Firefox the host is the tab's, so every request from that tab follows the override, as documented. On Chrome, which has no tab in a PAC script, the host is the request's. Override rows in the table use requests whose host is the tab's host, so both browsers must agree on them. Overrides take precedence over rules on both browsers, as on Firefox today.
4. Static extensions are applied on Chrome. Resource type bypass cannot be applied by a PAC script; on Chrome it is ignored, and the About text on Chrome says resource type bypass is Firefox only.
5. Nothing from the config reaches the PAC script outside a string literal, including a pattern holding a quote, a backslash, a line terminator, or the marker text the proxy test uses to edit the script. Covered by a test that evaluates the script built from such a config.
6. `npm test`, both dev builds, `npm run smoke:chrome`, and `npm run smoke:firefox` pass.
