import { z } from 'zod'
import { ProxyControlStateSchema } from '@schemas/proxyControl'

export type ProxyControlState = z.infer<typeof ProxyControlStateSchema>
