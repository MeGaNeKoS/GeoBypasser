# S03 Chrome routes exactly what a rule says

As a Chrome user, a rule sends through its proxy exactly the requests it names, the same requests it would on Firefox, and nothing else.

Before this story the Chrome PAC script passes raw match patterns to `shExpMatch`, which treats them as loose globs, so `*://*.example.com/*` also matches `http://evil.com/x.example.com/y`. Its force and bypass lines run before, and apart from, the rule's own match. Website overrides match any host that ends with the domain text, so `example.com` also matches `notexample.com`. Static extensions are never applied.

## Acceptance criteria

1. One table of rules and URLs is run through the Firefox request handler and through the generated Chrome PAC script, evaluated in a test. Both give the same route for every row. Rows include a host spoof such as `http://evil.com/x.example.com/y`, a scheme the pattern excludes, a port, a path boundary, a subdomain, a force pattern, a bypass pattern, and a static extension.
2. A rule's force and bypass patterns apply only to URLs its match patterns cover, on both browsers.
3. A website override for `example.com` applies to `example.com` and any subdomain of it, and to no other host, on both browsers. Covered by rows in the same table, including `notexample.com`.
4. Static extensions are applied on Chrome. Resource type bypass cannot be applied by a PAC script; on Chrome it is ignored, and the About text on Chrome says resource type bypass is Firefox only.
5. Nothing from the config reaches the PAC script outside a string literal, including a pattern holding a quote, a backslash, a line terminator, or the marker text the proxy test uses to edit the script. Covered by a test that evaluates the script built from such a config.
6. `npm test`, both dev builds, `npm run smoke:chrome`, and `npm run smoke:firefox` pass.
