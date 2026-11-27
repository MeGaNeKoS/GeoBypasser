import { z } from 'zod'
import { PROXY_TYPES } from '@constant/proxy'

export const ProxyTypeSchema = z.enum(PROXY_TYPES)
export const StorageModeSchema = z.enum(['local', 'cloud'])

export const ProxyIdSchema = z.string()
