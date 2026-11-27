import { element } from '../dom'
import { badge, type BadgeKind } from '../components/feedback'
import { otherExtensionsNote } from '../components/other-extensions-note'
import { aboutVersion } from '../sample-data'
import type { Browser } from '../model'
import type { SectionContext } from './section-context'

const LICENSE_NAME = 'Mozilla Public License 2.0'
const DESCRIPTIONS: Record<Browser, string> = {
  chrome: 'Manage a list of proxies and route browser traffic through them by site, or by request rule.',
  firefox: 'Manage a list of proxies and route browser traffic through them by tab, by site, or by request rule.',
}
const OTHER_EXTENSIONS_EXTRA = 'Requests that no tab proxy, site proxy, rule or default proxy applies to are left untouched, so another extension may route them.'
const CHROME_SITE_NOTE = 'On Chrome this covers requests to the site and its subdomains only.'
const LINKS: { label: string; href: string }[] = [
  { label: 'Project Repository', href: 'https://github.com/MeGaNeKoS/GeoBypasser' },
  { label: 'Known Website Bypass Rules and Community Proxies', href: 'https://github.com/MeGaNeKoS/GeoBypass-Rules' },
  { label: 'Support on Ko-fi', href: 'https://ko-fi.com/meganeko__' },
  { label: 'Support on Patreon', href: 'https://www.patreon.com/c/__meganeko__' },
]

export function aboutSection (context: SectionContext): HTMLElement {
  const { browser } = context.store.get()
  return element('section', { class: 'stack' },
    element('header', { class: 'list-section__header' },
      element('div', { class: 'list-section__header-text' },
        element('h2', { class: 'page-title' }, 'About'),
      ),
    ),
    element('section', { class: 'card stack' },
      element('p', {}, element('strong', {}, 'GeoBypass'), ` version ${aboutVersion}`),
      element('p', { class: 'help' }, DESCRIPTIONS[browser]),
    ),
    rulePriority(browser),
    featureList(browser),
    licenseCard(),
    linkList(),
  )
}

function rulePriority (browser: Browser): HTMLElement {
  return element('section', { class: 'card stack' },
    element('h3', { class: 'group-label' }, 'Rule priority'),
    element('ol', { class: 'stack' },
      element('li', {}, 'Tab specific rule: if a tab is assigned a proxy it takes priority.', chromeBadge(browser, 'firefox')),
      element('li', {}, 'Site rule: if the tab URL\'s domain matches a configured rule, that rule\'s proxy is used.', chromeBadge(browser, 'limited'),
        browser === 'chrome' ? element('p', { class: 'help' }, CHROME_SITE_NOTE) : null),
      element('li', {}, 'Request domain rule: existing rules that match the request URL.'),
      element('li', {}, 'Default proxy: used when no other rule matches.'),
      element('li', {}, 'Direct connection otherwise.'),
    ),
    otherExtensionsNote(browser, OTHER_EXTENSIONS_EXTRA),
  )
}

function featureList (browser: Browser): HTMLElement {
  return element('section', { class: 'card stack' },
    element('h3', { class: 'group-label' }, 'Features'),
    element('ul', { class: 'stack' },
      element('li', {}, 'Proxy list with per-tab assignment', chromeBadge(browser, 'firefox')),
      element('li', {}, 'Domain-based overrides', chromeBadge(browser, 'limited')),
      element('li', {}, 'Flexible matching rules with bypass and force patterns'),
      element('li', {}, 'Optional keep-alive monitoring for proxies', chromeBadge(browser, 'firefox')),
      element('li', {}, 'Network inspection with a collapsible usage tree and auto-refresh'),
    ),
  )
}

function licenseCard (): HTMLElement {
  return element('section', { class: 'card stack' },
    element('h3', { class: 'group-label' }, 'License'),
    element('p', {}, LICENSE_NAME),
  )
}

function linkList (): HTMLElement {
  return element('section', { class: 'card stack' },
    element('h3', { class: 'group-label' }, 'Links'),
    element('ul', { class: 'stack' },
      ...LINKS.map(link => element('li', {},
        element('a', { href: link.href, target: '_blank', rel: 'noopener' }, link.label),
      )),
    ),
  )
}

function chromeBadge (browser: Browser, kind: BadgeKind): HTMLElement | null {
  return browser === 'chrome' ? element('span', {}, ' ', badge(kind)) : null
}
