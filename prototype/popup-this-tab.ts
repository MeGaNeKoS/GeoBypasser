import { element, replaceContent } from '@ui/dom'
import { button } from '@ui/components/button'
import { statusLine } from '@ui/components/feedback'
import { segmented, type SegmentOption } from '@ui/components/controls'
import { proxySelect } from './components/proxy-select'
import { icon } from '@ui/icons'
import { defaults, popupTab } from './sample-data'
import { findProxy, proxyAddress, routeLabel } from './proxy-lookup'
import { isNotInControl } from './components/not-routing'
import type { Browser, ProxyControl } from './model'

type Scope = 'tab' | 'site'

export function popupThisTab (browser: Browser, proxyControl: ProxyControl): HTMLElement {
  const isChrome = browser === 'chrome'
  const scope: Scope = isChrome ? 'site' : 'tab'
  const notInEffect = isNotInControl(browser, proxyControl)
  const result = element('div', { role: 'status', 'aria-live': 'polite' })
  const usingLine = element('p', { class: 'help' }, usingText(popupTab.usingLabel, scope, notInEffect))
  const proxyField = proxySelect({ name: 'popupProxy', label: 'Proxy', selectedId: defaults.defaultProxyId })
  return element('section', { class: 'popup__tab stack' },
    element('h2', { class: 'group-label' }, 'This tab'),
    element('p', { class: 'popup__domain mono' }, popupTab.domain),
    usingLine,
    proxyField,
    segmented('Apply to', 'popup-scope', scopeOptions(isChrome), scope),
    element('div', { class: 'button-row' },
      button('Set', {
        variant: 'primary',
        onClick: () => {
          usingLine.textContent = usingText(routeLabel(selectedProxyId(proxyField)), scope, notInEffect)
          replaceContent(result, [statusLine(`Set for this ${scope}`)])
        },
      }),
      button('Clear', {
        onClick: () => {
          usingLine.textContent = usingText(routeLabel(defaults.defaultProxyId), scope, notInEffect)
          replaceContent(result, [statusLine(`Cleared for this ${scope}`)])
        },
      }),
      button('Test proxy', {
        disabled: isChrome,
        onClick: () => replaceContent(result, [statusLine(`Connected through ${testedAddress()}`)]),
      }),
    ),
    result,
    isChrome ? chromeNote() : null,
  )
}

function usingText (label: string, scope: Scope, notInEffect: boolean): string {
  const setting = `${label} (set for this ${scope})`
  return notInEffect ? `Saved, not in effect: ${setting}` : `Using: ${setting}`
}

function selectedProxyId (field: HTMLElement): string {
  return field.querySelector<HTMLSelectElement>('select')?.value ?? ''
}

function scopeOptions (isChrome: boolean): SegmentOption<Scope>[] {
  return [
    { value: 'tab', label: 'This tab', disabled: isChrome },
    { value: 'site', label: 'This site' },
  ]
}

function testedAddress (): string {
  const proxy = findProxy(defaults.defaultProxyId)
  return proxy ? proxyAddress(proxy) : 'the browser directly'
}

function chromeNote (): HTMLElement {
  return element('section', { class: 'note', role: 'note' },
    icon('info'),
    element('h3', { class: 'group-label' }, 'On Chrome'),
    element('div', { class: 'note__body stack' },
      element('p', { class: 'help' }, `A site proxy covers requests to ${popupTab.domain} and its subdomains, not other hosts the page loads from.`),
      element('p', { class: 'help' },
        'Per tab proxies and Test proxy here are Firefox only. ',
        element('a', { href: 'index.html#test' }, 'Test in dashboard'),
      ),
    ),
  )
}
