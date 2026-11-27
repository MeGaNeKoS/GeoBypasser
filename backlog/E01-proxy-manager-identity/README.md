# E01 Proxy manager identity

## Outcome

Everything a user or a store reviewer reads about GeoBypass describes a proxy manager: a list of proxies and the rules that decide which requests use them. No text promises a way around a region lock, mentions spoofing a location, or names a kind of service to unlock.

## Decision

GeoBypass is a general proxy manager. It ships with an empty proxy list and no rules; proxies and rules are configuration the user writes or imports. The name GeoBypass stays. The Community Rules import stays and keeps pointing at the GeoBypass-Rules repository.
