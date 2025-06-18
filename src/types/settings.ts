import { z } from 'zod'
import { GeoBypassRuntimeSettingsSchema, GeoBypassSettingsSchema } from '@schemas/settings'

export type GeoBypassSettings = z.infer<typeof GeoBypassSettingsSchema>
export type GeoBypassRuntimeSettings = z.infer<typeof GeoBypassRuntimeSettingsSchema>
