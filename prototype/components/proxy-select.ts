import { DIRECT_ID } from '../model'
import { findProxy, proxyAddress, usableProxies } from '../proxy-lookup'
import { selectField, type SelectOption } from '@ui/components/fields'

export type ProxySelectOptions = {
  name: string;
  label: string;
  selectedId: string;
  none?: string;
  directChoice?: boolean;
  placeholder?: string;
  help?: string;
  fault?: string;
}

const DEFAULT_PLACEHOLDER = 'Choose a proxy'

export function proxySelect (options: ProxySelectOptions): HTMLDivElement {
  const choices: SelectOption[] = [
    ...(options.none === undefined ? [] : [{ value: '', label: options.none }]),
    ...(options.directChoice === false ? [] : [{ value: DIRECT_ID, label: 'Direct' }]),
    ...usableProxies().map(proxy => ({ value: proxy.id, label: proxy.label || proxyAddress(proxy) })),
  ]
  if (options.selectedId === '' && options.none === undefined) {
    choices.unshift({ value: '', label: options.placeholder ?? DEFAULT_PLACEHOLDER, disabled: true })
  } else if (options.selectedId !== '' && !choices.some(choice => choice.value === options.selectedId)) {
    choices.push({ value: options.selectedId, label: unavailableLabel(options.selectedId), disabled: true })
  }
  return selectField({
    name: options.name,
    label: options.label,
    options: choices,
    selected: options.selectedId,
    help: options.help,
    fault: options.fault,
  })
}

function unavailableLabel (id: string): string {
  const proxy = findProxy(id)
  return `Unavailable: ${proxy ? proxy.label || proxy.id : id}`
}
