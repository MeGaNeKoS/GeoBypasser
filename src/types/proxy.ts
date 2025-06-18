import { z } from 'zod'
import {
  ProxyConfigSchema,
  ProxyListItemSchema,
  ProxyListRuntimeItemSchema,
  ProxyRuleSchema,
  RuntimeProxyRuleSchema,
  KeepAliveProxyRuleSchema,
  ProxyTestResultSchema,
} from '@schemas/proxy'

export type ProxyConfig = z.infer<typeof ProxyConfigSchema>
export type ProxyListItem = z.infer<typeof ProxyListItemSchema>
export type ProxyListRuntimeItem = z.infer<typeof ProxyListRuntimeItemSchema>
export type ProxyRule = z.infer<typeof ProxyRuleSchema>
export type RuntimeProxyRule = z.infer<typeof RuntimeProxyRuleSchema>
export type KeepAliveProxyRule = z.infer<typeof KeepAliveProxyRuleSchema>
export type ProxyTestResult = z.infer<typeof ProxyTestResultSchema>
