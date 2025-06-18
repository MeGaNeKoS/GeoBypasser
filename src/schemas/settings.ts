import { z } from 'zod'
import { KeepAliveProxyRuleSchema, ProxyListItemSchema, ProxyRuleSchema, RuntimeProxyRuleSchema } from '@schemas/proxy'
import { ProxyIdSchema } from '@schemas/generic'

export const GeoBypassSettingsSchema = z.object({
  proxyList: z.array(ProxyListItemSchema),
  defaultProxy: ProxyIdSchema.optional(),
  fallbackDirect: z.boolean().optional(),
  rules: z.array(ProxyRuleSchema),
  keepAliveRules: KeepAliveProxyRuleSchema.optional(),
  testProxyUrl: z.string(),
  perWebsiteOverride: z.record(ProxyIdSchema),
})

export const GeoBypassRuntimeSettingsSchema = GeoBypassSettingsSchema.omit({ rules: true }).extend({
  rules: z.array(RuntimeProxyRuleSchema),
})
