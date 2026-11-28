import { DIRECT_ROUTE } from './pacRoute'
import {
  emptyHostUsage,
  formatBytes,
  type HostUsage,
  type NetworkUsage,
  type PathNode,
  type RecordedRoute,
  type RouteTally,
} from './networkUsage'

export type TypeCount = { name: string; count: number };

export type RouteLine = {
  label: string;
  count: number;
  bytes: number;
  expected: boolean;
  proxied: boolean;
  ruleId?: number;
  ruleName?: string;
};

export type RequestLogRow = {
  page: string;
  host: string;
  requests: number;
  types: TypeCount[];
  results: string[];
  routes: RouteLine[];
  sentBytes: number;
  receivedBytes: number;
  unsizedCount: number;
  paths: Record<string, PathNode>;
};

export type RequestLogPage = {
  page: string;
  rows: RequestLogRow[];
  proxiedBytes: number;
  totalBytes: number;
};

const BLOCKED_STATUSES = [403, 451];
const UNKNOWN_ROUTE_TEXT = 'Unknown route';

export function requestLogPages (usage: NetworkUsage): RequestLogPage[] {
  const hostsByPage = new Map<string, Map<string, HostUsage>>();
  for (const tab of Object.values(usage)) {
    for (const [page, hosts] of Object.entries(tab)) {
      const pageHosts = hostsByPage.get(page) ?? new Map<string, HostUsage>();
      hostsByPage.set(page, pageHosts);
      for (const [host, hostUsage] of Object.entries(hosts)) {
        pageHosts.set(host, mergeHostUsage(pageHosts.get(host), hostUsage));
      }
    }
  }
  return [...hostsByPage].map(([page, hosts]) => requestLogPage(page, hosts));
}

export function resultLabels (usage: HostUsage): string[] {
  return [
    usage.ok > 0 ? `${usage.ok} OK` : undefined,
    ...Object.entries(usage.statuses).map(([code, count]) => statusLabel(Number(code), count)),
    ...Object.entries(usage.failures).map(([reason, count]) => `${count} failed: ${reason}`),
    usage.fromCache > 0 ? `${usage.fromCache} from cache` : undefined,
  ].filter(isLabel);
}

export function routeLabel (route: RecordedRoute): string {
  if (route.route === '') return UNKNOWN_ROUTE_TEXT;
  const base = route.route === DIRECT_ROUTE ? 'Direct' : route.route;
  const phrase = reasonPhrase(route);
  const withPhrase = phrase === undefined ? base : `${base} ${phrase}`;
  return route.inferred ? `${withPhrase} (inferred)` : withPhrase;
}

export function formatProxiedShare (page: RequestLogPage): string {
  return `${formatBytes(page.proxiedBytes)} of ${formatBytes(page.totalBytes)}`;
}

function requestLogPage (page: string, hosts: Map<string, HostUsage>): RequestLogPage {
  const rows = [...hosts].map(([host, hostUsage]) => requestLogRow(page, host, hostUsage));
  const lines = rows.flatMap(row => row.routes);
  return {
    page,
    rows,
    proxiedBytes: sumOf(lines.filter(line => line.proxied).map(line => line.bytes)),
    totalBytes: sumOf(lines.map(line => line.bytes)),
  };
}

function requestLogRow (page: string, host: string, hostUsage: HostUsage): RequestLogRow {
  return {
    page,
    host,
    requests: hostUsage.count,
    types: typeCountsOf(hostUsage.types),
    results: resultLabels(hostUsage),
    routes: Object.values(hostUsage.routes).map(routeLine),
    sentBytes: hostUsage.sent,
    receivedBytes: hostUsage.received,
    unsizedCount: hostUsage.unsizedCount,
    paths: hostUsage.paths,
  };
}

function routeLine (tally: RouteTally): RouteLine {
  const { route } = tally;
  return {
    label: routeLabel(route),
    count: tally.count,
    bytes: tally.bytes,
    expected: route.expected,
    proxied: route.route !== '' && route.route !== DIRECT_ROUTE,
    ruleId: route.rule?.index,
    ruleName: route.rule?.name,
  };
}

function reasonPhrase (route: RecordedRoute): string | undefined {
  switch (route.reason) {
    case 'rule':
    case 'bypass':
      return `by rule "${route.rule?.name ?? ''}"`;
    case 'site':
      return 'by site proxy';
    case 'tab':
      return 'by tab proxy';
    case 'staticExtension':
      return 'for a static file';
    case 'default':
      return route.route === DIRECT_ROUTE ? undefined : 'by default proxy';
    case 'unknown':
      return undefined;
  }
}

function statusLabel (code: number, count: number): string {
  const kind = BLOCKED_STATUSES.includes(code) ? 'blocked' : 'errors';
  return `${count} ${kind} (${code})`;
}

function typeCountsOf (types: Record<string, number>): TypeCount[] {
  return Object.entries(types)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function isLabel (label: string | undefined): label is string {
  return label !== undefined;
}

function sumOf (values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function mergeHostUsage (existing: HostUsage | undefined, incoming: HostUsage): HostUsage {
  const merged = existing ?? emptyHostUsage();
  merged.count += incoming.count;
  mergeCounts(merged.types, incoming.types);
  merged.ok += incoming.ok;
  mergeCounts(merged.statuses, incoming.statuses);
  mergeCounts(merged.failures, incoming.failures);
  merged.fromCache += incoming.fromCache;
  merged.sent += incoming.sent;
  merged.received += incoming.received;
  merged.unsizedCount += incoming.unsizedCount;
  mergeRoutes(merged.routes, incoming.routes);
  mergePaths(merged.paths, incoming.paths);
  return merged;
}

function mergeCounts (into: Record<string, number>, from: Record<string, number>): void {
  for (const [key, count] of Object.entries(from)) into[key] = (into[key] ?? 0) + count;
}

function mergeRoutes (into: Record<string, RouteTally>, from: Record<string, RouteTally>): void {
  for (const [key, tally] of Object.entries(from)) {
    const target = into[key] ?? { route: tally.route, count: 0, bytes: 0 };
    target.count += tally.count;
    target.bytes += tally.bytes;
    into[key] = target;
  }
}

function mergePaths (into: Record<string, PathNode>, from: Record<string, PathNode>): void {
  for (const [key, node] of Object.entries(from)) {
    const target = into[key] ?? { sent: 0, received: 0, children: Object.create(null) };
    target.sent += node.sent;
    target.received += node.received;
    mergePaths(target.children, node.children);
    into[key] = target;
  }
}
