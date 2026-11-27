# E05 Connection resilience

## Outcome

A short proxy hiccup does not look like an outage. The user is told a proxy is down only when it stays down, and is told once.

## Decisions

- The browser owns connections and retries. The extension cannot hold a connection open or replay a failed request. What it decides is when a failure is worth telling the user about.
- A proxy counts as down after several consecutive failed checks, not one.
- A rule names one proxy. Fallback to a direct connection is the only second route. There are no backup proxies, which keeps configuration simple.
- Proxy checks run only on Firefox, where keep-alive runs.
- The browser lets one extension control proxy settings at a time. GeoBypass cannot share control; it tells the user when it does not have it, where the browser lets it know, and says so plainly where it does not.
