import { z } from 'zod'
import {
  SetTabProxyMessageSchema,
  ClearTabProxyMessageSchema,
  TabProxyMessageSchema,
  MonitorNetworkMessageSchema,
  UnmonitorNetworkMessageSchema,
  IsMonitoredMessageSchema,
  NetworkMessageSchema,
  GetProxyControlMessageSchema,
  ProxyControlChangedMessageSchema,
  ProxyControlMessageSchema,
  TestSavedProxyMessageSchema,
  TestCustomProxyMessageSchema,
  TestProxyMessageSchema,
} from '@schemas/messages'

export type SetTabProxyMessage = z.infer<typeof SetTabProxyMessageSchema>
export type ClearTabProxyMessage = z.infer<typeof ClearTabProxyMessageSchema>
export type TabProxyMessage = z.infer<typeof TabProxyMessageSchema>
export type MonitorNetworkMessage = z.infer<typeof MonitorNetworkMessageSchema>
export type UnmonitorNetworkMessage = z.infer<typeof UnmonitorNetworkMessageSchema>
export type IsMonitoredMessage = z.infer<typeof IsMonitoredMessageSchema>
export type NetworkMessage = z.infer<typeof NetworkMessageSchema>
export type GetProxyControlMessage = z.infer<typeof GetProxyControlMessageSchema>
export type ProxyControlChangedMessage = z.infer<typeof ProxyControlChangedMessageSchema>
export type ProxyControlMessage = z.infer<typeof ProxyControlMessageSchema>
export type TestSavedProxyMessage = z.infer<typeof TestSavedProxyMessageSchema>
export type TestCustomProxyMessage = z.infer<typeof TestCustomProxyMessageSchema>
export type TestProxyMessage = z.infer<typeof TestProxyMessageSchema>
