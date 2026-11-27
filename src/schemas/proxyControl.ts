import { z } from 'zod'

export const ProxyControlStateSchema = z.enum([
  'active',
  'available',
  'overridden',
  'unavailable',
])
