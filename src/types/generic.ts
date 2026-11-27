import { z } from 'zod'
import {
  ProxyTypeSchema,
  ProxyIdSchema,
} from '@schemas/generic'

export type ProxyType = z.infer<typeof ProxyTypeSchema>
export type ProxyId = z.infer<typeof ProxyIdSchema>
