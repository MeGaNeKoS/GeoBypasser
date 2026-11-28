import { z } from 'zod'
import type { NetworkStats, NetworkStatsNode } from '@utils/network'

const byteCount = z.number().nonnegative()

const NetworkStatsNodeSchema: z.ZodType<NetworkStatsNode> = z.lazy(() => z.object({
  sent: byteCount,
  received: byteCount,
  children: z.record(NetworkStatsNodeSchema).optional(),
}))

export const NetworkStatsSchema: z.ZodType<NetworkStats> = z.object({
  total: NetworkStatsNodeSchema,
  domains: z.record(NetworkStatsNodeSchema),
})

export function assertNetworkStats (response: unknown): asserts response is NetworkStats {
  NetworkStatsSchema.parse(response)
}
