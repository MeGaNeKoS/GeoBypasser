import { element } from '@ui/dom'
import { icon } from '@ui/icons'
import type { Browser, ProxyControl } from '../model'
import { banner } from '@ui/components/feedback'

const TITLE = 'GeoBypass is not routing your traffic'
const OTHER_EXTENSION_BODY = "Another extension controls this browser's proxy settings, so your proxies, rules and site proxies are not in effect. Turn off or remove the other proxy extension on the extensions page (chrome://extensions). This message clears by itself once GeoBypass is back in control."
const POLICY_BODY = "A browser policy controls this browser's proxy settings, so your proxies, rules and site proxies are not in effect. This is usually set by your organisation or by other software on this device. GeoBypass cannot change it. Ask whoever manages this browser, or check the policy page (chrome://policy)."
const POPUP_OTHER_EXTENSION_TEXT = 'GeoBypass is not routing. Another extension controls proxy settings. Turn it off or remove it.'
const POPUP_POLICY_TEXT = 'GeoBypass is not routing. A browser policy controls proxy settings. GeoBypass cannot change it.'

export const ROUTING_AGAIN_TEXT = 'GeoBypass is routing again.'

export function isNotInControl (browser: Browser, control: ProxyControl): boolean {
  return browser === 'chrome' && control !== 'geobypass'
}

export function routingRestored (browser: Browser, previous: ProxyControl, current: ProxyControl): boolean {
  return isNotInControl(browser, previous) && !isNotInControl(browser, current)
}

export function dashboardNotRouting (browser: Browser, control: ProxyControl): HTMLDivElement | null {
  if (!isNotInControl(browser, control)) return null
  const isPolicy = control === 'policy'
  return banner({
    tone: 'danger',
    text: element('div', { class: 'stack' },
      element('strong', {}, TITLE),
      element('p', { class: 'help' }, isPolicy ? POLICY_BODY : OTHER_EXTENSION_BODY),
    ),
    action: isPolicy ? undefined : element('a', { class: 'button', href: 'chrome://extensions' }, 'Open extensions page'),
  })
}

export function popupNotRouting (browser: Browser, control: ProxyControl): HTMLElement | null {
  if (!isNotInControl(browser, control)) return null
  const isPolicy = control === 'policy'
  return element('section', { class: 'popup__not-routing', role: 'alert' },
    icon('alert'),
    element('div', { class: 'stack' },
      element('p', {}, isPolicy ? POPUP_POLICY_TEXT : POPUP_OTHER_EXTENSION_TEXT),
      isPolicy ? null : element('a', { class: 'button button--quiet', href: 'chrome://extensions' }, 'Open extensions page'),
    ),
  )
}
