import { z } from 'zod'
import { ProxyIdSchema } from '@schemas/generic'

export const SetTabProxyMessageSchema = z.object({
  type: z.literal('setTabProxy'),
  tabId: z.number(),
  proxyId: ProxyIdSchema,
})

export const ClearTabProxyMessageSchema = z.object({
  type: z.literal('clearTabProxy'),
  tabId: z.number(),
})

export const TabProxyMessageSchema = z.union([
  SetTabProxyMessageSchema,
  ClearTabProxyMessageSchema,
])

export const MonitorNetworkMessageSchema = z.object({
  type: z.literal('monitorTabNetwork'),
  tabId: z.number(),
})

export const UnmonitorNetworkMessageSchema = z.object({
  type: z.literal('unmonitorTabNetwork'),
  tabId: z.number(),
})

export const IsMonitoredMessageSchema = z.object({
  type: z.literal('isTabNetworkMonitored'),
  tabId: z.number(),
})

export const DevtoolsNetworkDataMessageSchema = z.object({
  type: z.literal('devtoolsNetworkData'),
  tabId: z.number(),
  url: z.string(),
  sentSize: z.number(),
  receivedSize: z.number(),
})

export const NetworkMessageSchema = z.union([
  z.object({ type: z.literal('getNetworkStats') }),
  z.object({ type: z.literal('clearNetworkStats') }),
  MonitorNetworkMessageSchema,
  UnmonitorNetworkMessageSchema,
  IsMonitoredMessageSchema,
  DevtoolsNetworkDataMessageSchema,
])
