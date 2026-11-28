import type { ProxyListItem } from '@customTypes/proxy'
import { DIRECT_ROUTE } from './pacRoute'
import {
  emptyHostUsage,
  formatBytes,
  type HostUsage,
  type NetworkUsage,
  type PathNode,
  type RecordedRoute,
  type RecordedRouteReason,
  type RouteTally,
} from './networkUsage'

export type TypeCount = { name: string; count: number };

export type RouteLine = {
  label: string;
  reason: RecordedRouteReason;
  count: number;
  bytes: number;
  expected: boolean;
  proxied: boolean;
  ruleId?: number;
  ruleName?: string;
};

export type ResultKind = 'ok' | 'blocked' | 'error' | 'failed' | 'cache';

export type ResultLine = { kind: ResultKind; text: string };

export type RequestLogRow = {
  page: string;
  host: string;
  requests: number;
  types: TypeCount[];
  results: ResultLine[];
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
  unsizedCount: number;
};

const BLOCKED_STATUSES = [403, 451];
const UNKNOWN_ROUTE_TEXT = 'Unknown route';
const DIRECT_TEXT = 'Direct';
const PAC_KEYWORD = /^\S+\s+/;

export function requestLogPages (usage: NetworkUsage, proxies: ProxyListItem[]): RequestLogPage[] {
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
  return [...hostsByPage].map(([page, hosts]) => requestLogPage(page, hosts, proxies));
}

export function resultLines (usage: HostUsage): ResultLine[] {
  const lines: (ResultLine | undefined)[] = [
    usage.ok > 0 ? { kind: 'ok', text: `${usage.ok} OK` } : undefined,
    ...Object.entries(usage.statuses).map(([code, count]) => statusLine(Number(code), count)),
    ...Object.entries(usage.failures).map(([reason, count]) => failedLine(reason, count)),
    usage.fromCache > 0 ? { kind: 'cache', text: `${usage.fromCache} from cache` } : undefined,
  ];
  return lines.filter(isLine);
}

export function routeLabel (route: RecordedRoute, proxies: ProxyListItem[]): string {
  if (route.route === '') return UNKNOWN_ROUTE_TEXT;
  const text = route.route === DIRECT_ROUTE ? DIRECT_TEXT : proxiedLabel(route, proxies);
  return route.inferred ? `${text} (inferred)` : text;
}

function proxiedLabel (route: RecordedRoute, proxies: ProxyListItem[]): string {
  const name = proxyNameFor(route, proxies);
  const phrase = reasonPhrase(route);
  return phrase === undefined ? name : `${name}, ${phrase}`;
}

function proxyNameFor (route: RecordedRoute, proxies: ProxyListItem[]): string {
  const proxy = proxies.find(candidate => candidate.id === route.proxyId);
  if (proxy?.label) return proxy.label;
  if (proxy) return `${proxy.host}:${proxy.port}`;
  return route.route.replace(PAC_KEYWORD, '');
}

export function formatProxiedShare (page: RequestLogPage): string {
  const share = `${formatBytes(page.proxiedBytes)} of ${formatBytes(page.totalBytes)}`;
  return page.unsizedCount === 0 ? share : `${share} (${formatCount(page.unsizedCount, 'request')} without a size)`;
}

export function formatCount (count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

function requestLogPage (page: string, hosts: Map<string, HostUsage>, proxies: ProxyListItem[]): RequestLogPage {
  const rows = [...hosts].map(([host, hostUsage]) => requestLogRow(page, host, hostUsage, proxies));
  const lines = rows.flatMap(row => row.routes);
  return {
    page,
    rows,
    proxiedBytes: sumOf(lines.filter(line => line.proxied).map(line => line.bytes)),
    totalBytes: sumOf(lines.map(line => line.bytes)),
    unsizedCount: sumOf(rows.map(row => row.unsizedCount)),
  };
}

function requestLogRow (page: string, host: string, hostUsage: HostUsage, proxies: ProxyListItem[]): RequestLogRow {
  return {
    page,
    host,
    requests: hostUsage.count,
    types: typeCountsOf(hostUsage.types),
    results: resultLines(hostUsage),
    routes: Object.values(hostUsage.routes).map(tally => routeLine(tally, proxies)),
    sentBytes: hostUsage.sent,
    receivedBytes: hostUsage.received,
    unsizedCount: hostUsage.unsizedCount,
    paths: hostUsage.paths,
  };
}

function routeLine (tally: RouteTally, proxies: ProxyListItem[]): RouteLine {
  const { route } = tally;
  return {
    label: routeLabel(route, proxies),
    reason: route.reason,
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
      return `by rule '${route.rule?.name ?? ''}'`;
    case 'site':
      return 'by site proxy';
    case 'tab':
      return 'by tab proxy';
    case 'staticExtension':
      return 'for a static file';
    case 'default':
      return 'default proxy';
    case 'unknown':
      return undefined;
  }
}

function failedLine (reason: string, count: number): ResultLine {
  return { kind: 'failed', text: `${count} failed: ${reason}` };
}

function statusLine (code: number, count: number): ResultLine {
  if (BLOCKED_STATUSES.includes(code)) return { kind: 'blocked', text: `${count} blocked (${code})` };
  return { kind: 'error', text: `${count} errors (${code})` };
}

function typeCountsOf (types: Record<string, number>): TypeCount[] {
  return Object.entries(types)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function isLine (line: ResultLine | undefined): line is ResultLine {
  return line !== undefined;
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
