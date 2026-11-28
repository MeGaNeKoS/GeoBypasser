import { DIRECT_PROXY_ID } from '@constant/proxy'
import { DIRECT_LABEL, proxyOptions, storedProxyLabel } from '@utils/pageView'
import { selectField } from './fields'

const UNAVAILABLE_PREFIX = 'Unavailable: '
const CHOOSE_PROXY_LABEL = 'Choose a proxy'
const SET_ASIDE_PROXY_HELP = 'This proxy is not used because it is invalid. Fix it in Proxies, or choose another.'

export type ProxyChoices = {
  includeDirect: boolean;
  excludedProxyIds: readonly string[];
}

const ALL_PROXY_CHOICES: ProxyChoices = { includeDirect: true, excludedProxyIds: [] }

export type ProxySelectOptions = {
  name: string;
  label: string;
  proxyList: unknown;
  proxyId: string;
  fault: string | undefined;
  choices?: ProxyChoices;
}

export function proxySelectField (options: ProxySelectOptions): HTMLDivElement {
  const choices = options.choices ?? ALL_PROXY_CHOICES
  const usable = proxyOptions(options.proxyList)
    .filter(proxy => !choices.excludedProxyIds.includes(proxy.id))
    .map(proxy => ({ value: proxy.id, label: proxy.label || proxy.host }))
  const directOffered = choices.includeDirect ? [{ value: DIRECT_PROXY_ID, label: DIRECT_LABEL }] : []
  const known = options.proxyId === '' || usable.some(option => option.value === options.proxyId)
    || (choices.includeDirect && options.proxyId === DIRECT_PROXY_ID)
  const storedLabel = storedProxyLabel(options.proxyList, options.proxyId)
  const unavailable = known ? [] : [{ value: options.proxyId, label: unavailableLabel(storedLabel, options.proxyId), disabled: true }]
  const placeholder = options.proxyId === '' ? [{ value: '', label: CHOOSE_PROXY_LABEL }] : []
  return selectField({
    name: options.name,
    label: options.label,
    fault: options.fault,
    help: known || storedLabel === undefined ? undefined : SET_ASIDE_PROXY_HELP,
    options: [...placeholder, ...directOffered, ...usable, ...unavailable],
    selected: options.proxyId,
  })
}

function unavailableLabel (storedLabel: string | undefined, proxyId: string): string {
  return storedLabel === undefined ? proxyId : `${UNAVAILABLE_PREFIX}${storedLabel}`
}
