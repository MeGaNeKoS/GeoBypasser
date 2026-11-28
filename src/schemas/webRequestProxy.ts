import { z } from 'zod'

const ProxyInfoSchema = z.object({
  type: z.string(),
  host: z.string().optional(),
  port: z.number().optional(),
})

export const WebRequestProxySchema = z.object({
  proxyInfo: ProxyInfoSchema.nullish(),
})
