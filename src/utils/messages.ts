import { TabProxyMessage, NetworkMessage, ProxyControlMessage, TestProxyMessage } from '@customTypes/messages'
import { NetworkMessageSchema, ProxyControlMessageSchema, TabProxyMessageSchema, TestProxyMessageSchema } from '@schemas/messages'

export function isTabProxyMessage (msg: unknown): msg is TabProxyMessage {
  return TabProxyMessageSchema.safeParse(msg).success
}

export function isNetworkMessage (msg: unknown): msg is NetworkMessage {
  return NetworkMessageSchema.safeParse(msg).success
}

export function isProxyControlMessage (msg: unknown): msg is ProxyControlMessage {
  return ProxyControlMessageSchema.safeParse(msg).success
}

export function isTestProxyMessage (msg: unknown): msg is TestProxyMessage {
  return TestProxyMessageSchema.safeParse(msg).success
}
