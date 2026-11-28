import { DIRECT_PROXY_ID } from '@constant/proxy'
import { DIRECT_LABEL, proxyOptions } from '@utils/pageView'
import { selectField } from './fields'

const UNAVAILABLE_PREFIX = 'Unavailable: '
const CHOOSE_PROXY_LABEL = 'Choose a proxy'

export type ProxySelectOptions = {
  name: string;
  label: string;
  proxyList: unknown;
  proxyId: string;
  fault: string | undefined;
}

export function proxySelectField (options: ProxySelectOptions): HTMLDivElement {
  const usable = proxyOptions(options.proxyList).map(proxy => ({ value: proxy.id, label: proxy.label || proxy.host }))
  const known = options.proxyId === '' || options.proxyId === DIRECT_PROXY_ID || usable.some(option => option.value === options.proxyId)
  const unavailable = known ? [] : [{ value: options.proxyId, label: `${UNAVAILABLE_PREFIX}${options.proxyId}`, disabled: true }]
  const placeholder = options.proxyId === '' ? [{ value: '', label: CHOOSE_PROXY_LABEL }] : []
  return selectField({
    name: options.name,
    label: options.label,
    fault: options.fault,
    options: [...placeholder, { value: DIRECT_PROXY_ID, label: DIRECT_LABEL }, ...usable, ...unavailable],
    selected: options.proxyId,
  })
}
