import { z } from 'zod'
import { ProxyIdSchema, ProxyTypeSchema } from '@schemas/generic'
import { DIRECT_PROXY_ID } from '@constant/proxy'

export const ProxyConfigSchema = z.object({
  type: ProxyTypeSchema,
  proxyDNS: z.boolean(),
  host: z.string(),
  port: z.number(),
  username: z.string().optional(),
  password: z.string().optional(),
  failoverTimeout: z.number().optional(),
})

export const ProxyListItemSchema = ProxyConfigSchema.extend({
  id: ProxyIdSchema,
  label: z.string().optional(),
  notifyIfDown: z.boolean().optional(),
})

export const ProxyListRuntimeItemSchema = ProxyListItemSchema.extend({
  downNotification: z.number().optional(),
})

export const RuleProxyIdSchema = z.union([
  ProxyIdSchema,
  z.literal(DIRECT_PROXY_ID),
])

export const ProxyRuleSchema = z.object({
  active: z.boolean(),
  name: z.string(),
  match: z.array(z.string()),
  bypassUrlPatterns: z.array(z.string()).optional(),
  bypassResourceTypes: z.array(z.string()).optional(),
  staticExtensions: z.string().optional(),
  forceProxyUrlPatterns: z.array(z.string()).optional(),
  fallbackDirect: z.boolean().optional(),
  proxyId: RuleProxyIdSchema,
})

export const RuntimeProxyRuleSchema = ProxyRuleSchema.extend({
  compiledMatch: z.any().optional(), // Matcher can't be validated at runtime
  compiledBypassUrlPatterns: z.any().optional(),
  compiledForceProxyUrlPatterns: z.any().optional(),
  compiledStaticExtensions: z.instanceof(RegExp).optional(),
})

export const KeepAliveProxyRuleSchema = z.record(
  z.object({
    active: z.boolean(),
    tabUrls: z.array(z.string()),
    testProxyUrl: z.string().optional(),
  })
)

export const ProxyTestResultSchema = z.union([
  z.object({
    success: z.literal(true),
    proxy: z.string(),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
    proxy: z.string(),
  }),
])
