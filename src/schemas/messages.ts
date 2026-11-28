import { z } from 'zod'
import { ProxyIdSchema } from '@schemas/generic'
import { ProxyControlStateSchema } from '@schemas/proxyControl'
import { ProxyListItemSchema } from '@schemas/proxy'

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

export const NetworkMessageSchema = z.union([
  z.object({ type: z.literal('getNetworkStats') }),
  z.object({ type: z.literal('clearNetworkStats') }),
  MonitorNetworkMessageSchema,
  UnmonitorNetworkMessageSchema,
  IsMonitoredMessageSchema,
])

export const GetProxyControlMessageSchema = z.object({
  type: z.literal('getProxyControl'),
})

export const ProxyControlChangedMessageSchema = z.object({
  type: z.literal('proxyControlChanged'),
  state: ProxyControlStateSchema,
})

export const ProxyControlMessageSchema = z.union([
  GetProxyControlMessageSchema,
  ProxyControlChangedMessageSchema,
])

export const TestSavedProxyMessageSchema = z.object({
  type: z.literal('testProxy'),
  proxyId: ProxyIdSchema,
})

export const TestCustomProxyMessageSchema = z.object({
  type: z.literal('testProxy'),
  proxy: ProxyListItemSchema,
})

export const TestProxyMessageSchema = z.union([
  TestSavedProxyMessageSchema,
  TestCustomProxyMessageSchema,
])
