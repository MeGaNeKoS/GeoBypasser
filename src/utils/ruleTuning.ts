import type { RuleForm } from '@utils/ruleDraft'
import { nonBlank } from '@utils/ruleDraft'
import { isValidStaticExtensions } from '@utils/validity'

export type TuningPhrase = {
  text: string;
  firefoxOnly: boolean;
}

export const SUMMARY_PHRASE_LIMIT = 2

const NEVER_TYPES_HELP = 'Requests of the ticked types connect directly.'
const ONLY_TYPES_HELP = 'Only requests of the ticked types use the proxy. Every other type connects directly.'
const NO_TYPE_TICKED_HELP = 'No type is ticked, so every type uses the proxy.'

export function tuningPhrasesOf (form: RuleForm): TuningPhrase[] {
  const candidates: (TuningPhrase | undefined)[] = [
    countPhrase(nonBlank(form.bypassUrlPatterns).length, 'skips', 'host', 'hosts', false),
    countPhrase(nonBlank(form.forceProxyUrlPatterns).length, 'forces', 'host', 'hosts', false),
    ...resourceTypePhrases(form),
    staticExtensionsPhrase(form.staticExtensions),
    countPhrase(nonBlank(form.proxyOnlyPageHostnames).length, 'on', 'site', 'sites', true),
  ]
  return candidates.filter((phrase): phrase is TuningPhrase => phrase !== undefined)
}

export function summaryPhrasesShown (phrases: TuningPhrase[]): { shown: TuningPhrase[]; hiddenCount: number } {
  return {
    shown: phrases.slice(0, SUMMARY_PHRASE_LIMIT),
    hiddenCount: Math.max(0, phrases.length - SUMMARY_PHRASE_LIMIT),
  }
}

export function resourceTypeHelpOf (form: RuleForm): string {
  const ticked = form.resourceTypeMode === 'only' ? form.onlyResourceTypes : form.neverResourceTypes
  if (ticked.length === 0) return NO_TYPE_TICKED_HELP
  return form.resourceTypeMode === 'only' ? ONLY_TYPES_HELP : NEVER_TYPES_HELP
}

export function chromeIgnoresLimits (form: RuleForm): boolean {
  const onlyTypesTicked = form.resourceTypeMode === 'only' && form.onlyResourceTypes.length > 0
  return onlyTypesTicked || nonBlank(form.proxyOnlyPageHostnames).length > 0
}

function staticExtensionsPhrase (value: string): TuningPhrase | undefined {
  const isSet = value.trim() !== ''
  return isSet && isValidStaticExtensions(value) ? { text: 'skips files', firefoxOnly: false } : undefined
}

function resourceTypePhrases (form: RuleForm): TuningPhrase[] {
  const neverPhrase = countPhrase(form.neverResourceTypes.length, 'skips', 'type', 'types', true)
  const onlyPhrase = countPhrase(form.onlyResourceTypes.length, 'only', 'type', 'types', true)
  if (neverPhrase && onlyPhrase) return [neverPhrase, onlyPhrase]
  const phrase = resourceTypePhrase(form)
  return phrase ? [phrase] : []
}

function resourceTypePhrase (form: RuleForm): TuningPhrase | undefined {
  if (form.resourceTypeMode === 'only') {
    return countPhrase(form.onlyResourceTypes.length, 'only', 'type', 'types', true)
  }
  return countPhrase(form.neverResourceTypes.length, 'skips', 'type', 'types', true)
}

function countPhrase (count: number, verb: string, singular: string, plural: string, firefoxOnly: boolean): TuningPhrase | undefined {
  if (count === 0) return undefined
  return { text: `${verb} ${count} ${count === 1 ? singular : plural}`, firefoxOnly }
}
