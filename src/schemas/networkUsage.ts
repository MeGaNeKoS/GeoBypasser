import { z } from 'zod'
import type { HostUsage, NetworkUsage, PageUsage, PathNode, RecordedRoute, RouteTally, TabUsage } from '@utils/networkUsage'

type Pairs<Value> = [string, Value][]

type WirePathNode = {
  sent: number;
  received: number;
  children: Pairs<WirePathNode>;
};

type WireHostUsage = Omit<HostUsage, 'types' | 'statuses' | 'failures' | 'routes' | 'paths'> & {
  types: Pairs<number>;
  statuses: Pairs<number>;
  failures: Pairs<number>;
  routes: Pairs<RouteTally>;
  paths: Pairs<WirePathNode>;
};

export type WireNetworkUsage = Pairs<Pairs<Pairs<WireHostUsage>>>;

const byteCount = z.number().nonnegative()
const tally = z.number().int().nonnegative()

const RuleRefSchema = z.object({ index: tally, name: z.string() })

const RecordedRouteSchema: z.ZodType<RecordedRoute> = z.object({
  reason: z.enum(['tab', 'site', 'rule', 'bypass', 'staticExtension', 'default', 'unknown']),
  route: z.string(),
  expected: z.boolean(),
  rule: RuleRefSchema.optional(),
  proxyId: z.string().optional(),
  inferred: z.boolean().optional(),
})

const RouteTallySchema: z.ZodType<RouteTally> = z.object({
  route: RecordedRouteSchema,
  count: tally,
  bytes: byteCount,
})

function pairList<Schema extends z.ZodTypeAny> (value: Schema) {
  return z.array(z.tuple([z.string(), value]))
}

const PathNodeWireSchema: z.ZodType<WirePathNode> = z.lazy(() => z.object({
  sent: byteCount,
  received: byteCount,
  children: pairList(PathNodeWireSchema),
}))

const HostUsageWireSchema: z.ZodType<WireHostUsage> = z.object({
  count: tally,
  types: pairList(tally),
  ok: tally,
  statuses: pairList(tally),
  failures: pairList(tally),
  fromCache: tally,
  sent: byteCount,
  received: byteCount,
  unsizedCount: tally,
  routes: pairList(RouteTallySchema),
  paths: pairList(PathNodeWireSchema),
})

export const NetworkUsageWireSchema: z.ZodType<WireNetworkUsage> = pairList(pairList(pairList(HostUsageWireSchema)))

function toPairs<Value, Encoded> (map: Record<string, Value>, encode: (value: Value) => Encoded): Pairs<Encoded> {
  return Object.entries(map).map(([key, value]): [string, Encoded] => [key, encode(value)])
}

function fromPairs<Value, Decoded> (pairs: Pairs<Value>, decode: (value: Value) => Decoded): Record<string, Decoded> {
  const map: Record<string, Decoded> = Object.create(null)
  for (const [key, value] of pairs) map[key] = decode(value)
  return map
}

const unchanged = <Value>(value: Value): Value => value

function pathNodeToWire (node: PathNode): WirePathNode {
  return { sent: node.sent, received: node.received, children: toPairs(node.children, pathNodeToWire) }
}

function pathNodeFromWire (node: WirePathNode): PathNode {
  return { sent: node.sent, received: node.received, children: fromPairs(node.children, pathNodeFromWire) }
}

function hostUsageToWire (host: HostUsage): WireHostUsage {
  return {
    ...host,
    types: toPairs(host.types, unchanged),
    statuses: toPairs(host.statuses, unchanged),
    failures: toPairs(host.failures, unchanged),
    routes: toPairs(host.routes, unchanged),
    paths: toPairs(host.paths, pathNodeToWire),
  }
}

function hostUsageFromWire (host: WireHostUsage): HostUsage {
  return {
    ...host,
    types: fromPairs(host.types, unchanged),
    statuses: fromPairs(host.statuses, unchanged),
    failures: fromPairs(host.failures, unchanged),
    routes: fromPairs(host.routes, unchanged),
    paths: fromPairs(host.paths, pathNodeFromWire),
  }
}

function pageUsageToWire (page: PageUsage): Pairs<WireHostUsage> {
  return toPairs(page, hostUsageToWire)
}

function tabUsageToWire (tab: TabUsage): Pairs<Pairs<WireHostUsage>> {
  return toPairs(tab, pageUsageToWire)
}

export function networkUsageToWire (usage: NetworkUsage): WireNetworkUsage {
  return toPairs(usage, tabUsageToWire)
}

function networkUsageFromWire (usage: WireNetworkUsage): NetworkUsage {
  return fromPairs(usage, tabPairs => fromPairs(tabPairs, pagePairs => fromPairs(pagePairs, hostUsageFromWire)))
}

export function parseNetworkUsageReply (response: unknown): NetworkUsage {
  return networkUsageFromWire(NetworkUsageWireSchema.parse(response))
}
