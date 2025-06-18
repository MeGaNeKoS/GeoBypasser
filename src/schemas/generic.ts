import { z } from 'zod'

export const ProxyTypeSchema = z.enum(['socks', 'http'])
export const StorageModeSchema = z.enum(['local', 'cloud'])

export const ProxyIdSchema = z.string()
