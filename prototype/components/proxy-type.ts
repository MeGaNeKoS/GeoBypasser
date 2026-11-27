import { segmented, type SegmentOption } from './controls'
import type { ProxyType } from '../model'

const TYPE_OPTIONS: SegmentOption<ProxyType>[] = [
  { value: 'http', label: 'HTTP' },
  { value: 'socks5', label: 'SOCKS5' },
]

export function proxyTypeSegmented (name: string, selected: string): HTMLFieldSetElement {
  return segmented('Type', name, TYPE_OPTIONS, asProxyType(selected))
}

export function asProxyType (value: string): ProxyType {
  return value === 'http' ? 'http' : 'socks5'
}
