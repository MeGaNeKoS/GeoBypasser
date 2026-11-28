import type { ExpectedRoute, RouteReason, RuleRef } from './expectedRoute'

export type RecordedRouteReason = RouteReason | 'tab' | 'unknown'

export type RecordedRoute = {
  reason: RecordedRouteReason;
  route: string;
  expected: boolean;
  rule?: RuleRef;
};

export type RequestObservation = {
  pageHost: string;
  requestUrl: string;
  resourceType: string;
  statusCode?: number;
  error?: string;
  fromCache: boolean;
  sentBytes: number;
  receivedBytes: number;
  receivedSizeKnown: boolean;
  route: RecordedRoute;
};

export type PathNode = {
  sent: number;
  received: number;
  children: Record<string, PathNode>;
};

export type RouteTally = {
  route: RecordedRoute;
  count: number;
};

export type HostUsage = {
  count: number;
  types: Record<string, number>;
  ok: number;
  statuses: Record<string, number>;
  failures: Record<string, number>;
  fromCache: number;
  sent: number;
  received: number;
  unsizedCount: number;
  routes: Record<string, RouteTally>;
  paths: Record<string, PathNode>;
};

export type PageUsage = Record<string, HostUsage>;
export type TabUsage = Record<string, PageUsage>;
export type NetworkUsage = Record<string, TabUsage>;

export const UNKNOWN_ROUTE: RecordedRoute = { reason: 'unknown', route: '', expected: false };

const FAILED_STATUS_FROM = 400;
const UNITS = ['KB', 'MB', 'GB', 'TB'];
const BYTES_PER_UNIT = 1024;

export function emptyTabUsage (): TabUsage {
  return Object.create(null);
}

export function pageHostFor (requestUrl: string, documentUrl: string | undefined): string {
  return hostOf(documentUrl ?? '') || hostOf(requestUrl);
}

export function addRequestToTab (tab: TabUsage, observation: RequestObservation): void {
  const requestUrl = parseUrl(observation.requestUrl);
  if (!requestUrl) return
  const page = pageUsageFor(tab, observation.pageHost);
  const host = hostUsageFor(page, requestUrl.hostname);
  recordHostRequest(host, requestUrl.pathname, observation);
}

export function formatBytes (bytes: number): string {
  if (bytes < BYTES_PER_UNIT) return `${bytes} B`;
  let value = bytes;
  let unitIndex = -1;
  while (value >= BYTES_PER_UNIT && unitIndex < UNITS.length - 1) {
    value /= BYTES_PER_UNIT;
    unitIndex++;
  }
  return `${value.toFixed(2)} ${UNITS[unitIndex]}`;
}

function hostOf (text: string): string {
  return parseUrl(text)?.hostname ?? '';
}

function parseUrl (text: string): URL | undefined {
  try {
    return new URL(text);
  } catch {
    return undefined;
  }
}

function pageUsageFor (tab: TabUsage, pageHost: string): PageUsage {
  if (!tab[pageHost]) tab[pageHost] = Object.create(null);
  return tab[pageHost];
}

function hostUsageFor (page: PageUsage, requestHost: string): HostUsage {
  if (!page[requestHost]) page[requestHost] = emptyHostUsage();
  return page[requestHost];
}

function emptyHostUsage (): HostUsage {
  return {
    count: 0,
    types: Object.create(null),
    ok: 0,
    statuses: Object.create(null),
    failures: Object.create(null),
    fromCache: 0,
    sent: 0,
    received: 0,
    unsizedCount: 0,
    routes: Object.create(null),
    paths: Object.create(null),
  };
}

function recordHostRequest (host: HostUsage, pathname: string, observation: RequestObservation): void {
  host.count += 1;
  increment(host.types, observation.resourceType);
  recordResult(host, observation);
  if (observation.fromCache) host.fromCache += 1;
  host.sent += observation.sentBytes;
  host.received += observation.receivedBytes;
  if (!observation.receivedSizeKnown) host.unsizedCount += 1;
  tallyRoute(host, observation.route);
  addPath(host.paths, pathname, observation.sentBytes, observation.receivedBytes);
}

function recordResult (host: HostUsage, observation: RequestObservation): void {
  if (observation.error !== undefined) {
    increment(host.failures, observation.error);
    return
  }
  if (observation.statusCode === undefined || observation.statusCode < FAILED_STATUS_FROM) {
    host.ok += 1;
    return
  }
  increment(host.statuses, String(observation.statusCode));
}

function tallyRoute (host: HostUsage, route: RecordedRoute): void {
  const key = routeKey(route);
  if (!host.routes[key]) host.routes[key] = { route, count: 0 };
  host.routes[key].count += 1;
}

function routeKey (route: RecordedRoute): string {
  return [route.reason, route.route, route.rule?.index ?? ''].join('|');
}

function increment (counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

function addPath (paths: Record<string, PathNode>, pathname: string, sent: number, received: number): void {
  const segments = pathname.split('/').filter(Boolean);
  const first = pathNodeFor(paths, segments[0] ?? '/');
  addToPath(first, sent, received);
  if (segments[1] !== undefined) addToPath(pathNodeFor(first.children, segments[1]), sent, received);
}

function pathNodeFor (children: Record<string, PathNode>, key: string): PathNode {
  if (!children[key]) children[key] = { sent: 0, received: 0, children: Object.create(null) };
  return children[key];
}

function addToPath (node: PathNode, sent: number, received: number): void {
  node.sent += sent;
  node.received += received;
}

export function expectedRecordedRoute (expected: ExpectedRoute): RecordedRoute {
  return { reason: expected.reason, route: expected.route, expected: true, rule: expected.rule };
}
