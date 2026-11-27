# E03 Core architecture

## Outcome

Whoever maintains GeoBypass can find where a behaviour lives. Proxy auth, the routing decision, keep-alive, network statistics, and config handling each have one home that both browsers use. Where Firefox and Chrome have to differ, the difference sits in one named place.

## Decisions

- One browser independent core owns config, the routing decision, proxy auth, keep-alive, and network statistics.
- Each browser has a thin adapter that connects the core to that browser's proxy mechanism: `proxy.onRequest` on Firefox, a PAC script on Chrome.
- Runtime messages between the pages and the background have one definition, and that definition validates them at runtime.
- A file holds one responsibility and stays under 1000 lines.
- The dashboard, popup, and devtools pages are restructured in E04, not here.
