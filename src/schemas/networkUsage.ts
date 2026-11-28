import { z } from 'zod'
import type { HostUsage, NetworkUsage, PathNode, RecordedRoute, RouteTally } from '@utils/networkUsage'

const byteCount = z.number().nonnegative()
const tally = z.number().int().nonnegative()
const countsByKey = z.record(z.string(), tally)

const RuleRefSchema = z.object({ index: tally, name: z.string() })

const RecordedRouteSchema: z.ZodType<RecordedRoute> = z.object({
  reason: z.enum(['tab', 'site', 'rule', 'bypass', 'staticExtension', 'default', 'unknown']),
  route: z.string(),
  expected: z.boolean(),
  rule: RuleRefSchema.optional(),
})

const RouteTallySchema: z.ZodType<RouteTally> = z.object({
  route: RecordedRouteSchema,
  count: tally,
})

const PathNodeSchema: z.ZodType<PathNode> = z.lazy(() => z.object({
  sent: byteCount,
  received: byteCount,
  children: z.record(z.string(), PathNodeSchema),
}))

const HostUsageSchema: z.ZodType<HostUsage> = z.object({
  count: tally,
  types: countsByKey,
  ok: tally,
  statuses: countsByKey,
  failures: countsByKey,
  fromCache: tally,
  sent: byteCount,
  received: byteCount,
  unsizedCount: tally,
  routes: z.record(z.string(), RouteTallySchema),
  paths: z.record(z.string(), PathNodeSchema),
})

export const NetworkUsageSchema: z.ZodType<NetworkUsage> = z.record(
  z.string(),
  z.record(z.string(), z.record(z.string(), HostUsageSchema)),
)

export function assertNetworkUsage (response: unknown): asserts response is NetworkUsage {
  NetworkUsageSchema.parse(response)
}
