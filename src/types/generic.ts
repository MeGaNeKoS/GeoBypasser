import { z } from 'zod'
import {
  ProxyTypeSchema,
  StorageModeSchema,
  ProxyIdSchema,
} from '@schemas/generic'

export type ProxyType = z.infer<typeof ProxyTypeSchema>
export type StorageMode = z.infer<typeof StorageModeSchema>
export type ProxyId = z.infer<typeof ProxyIdSchema>
