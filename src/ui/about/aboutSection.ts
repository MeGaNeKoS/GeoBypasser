import browser from 'webextension-polyfill'
import { supportsProxyOnRequest } from '@utils/env'
import { badge } from '../components/feedback'
import type { BadgeKind } from '../components/feedback'
import { otherExtensionsNote } from '../components/other-extensions-note'
import { sectionHeading } from '../components/section-heading'
import { element, replaceContent, requireElement } from '../dom'
import type { Child } from '../dom'

const ABOUT_CONTAINER_ID = 'aboutContent'
const HEADING = 'About'
const LICENSE = 'Mozilla Public License 2.0'
const OTHER_EXTENSIONS_DETAIL = 'Requests that no tab proxy, site proxy, rule or default proxy applies to are left untouched, so another extension may route them.'
const CHROME_SITE_SCOPE = 'On Chrome this covers requests to the site and its subdomains only.'

type AboutLink = { label: string; href: string }

type PriorityTier = {
  name: string
  description: string
  badge?: BadgeKind
  chromeNote?: string
}

const ABOUT_LINKS: AboutLink[] = [
  { label: 'Project Repository', href: 'https://github.com/MeGaNeKoS/GeoBypasser' },
  { label: 'Known Website Bypass Rules and Community Proxies', href: 'https://github.com/MeGaNeKoS/GeoBypass-Rules' },
  { label: 'Support on Ko-fi', href: 'https://ko-fi.com/meganeko__' },
  { label: 'Support on Patreon', href: 'https://www.patreon.com/c/__meganeko__' },
]

const PRIORITY_TIERS: PriorityTier[] = [
  { name: 'Tab specific rule', description: 'If a tab is assigned a proxy it takes priority.', badge: 'firefox' },
  {
    name: 'Main site rule',
    description: "If the tab URL's domain matches a configured rule the proxy from that rule is used.",
    badge: 'limited',
    chromeNote: CHROME_SITE_SCOPE,
  },
  { name: 'Request domain rule', description: 'Existing rules that match the request URL.' },
  { name: 'Default proxy', description: 'Used when no other rule matches.' },
  { name: 'Direct connection', description: 'Used when nothing above applies.' },
]

export function renderAboutSection (): void {
  replaceContent(requireElement(ABOUT_CONTAINER_ID), aboutContent())
}

function aboutContent (): Node[] {
  const { name, version, description } = browser.runtime.getManifest()
  return [
    element('div', { class: 'stack' },
      sectionHeading(HEADING),
      element('div', { class: 'settings-card' },
        element('p', {}, element('strong', {}, name), ` version ${version}`),
        element('p', {}, description ?? ''),
      ),
      element('div', { class: 'settings-card' },
        element('h3', {}, 'Rule priority'),
        element('ol', { class: 'about-priority' }, ...PRIORITY_TIERS.map(priorityItem)),
        ...(supportsProxyOnRequest ? [otherExtensionsNote(OTHER_EXTENSIONS_DETAIL)] : []),
      ),
      element('div', { class: 'settings-card' },
        element('h3', {}, 'Features'),
        element('ul', { class: 'about-list' }, ...featureItems()),
      ),
      element('div', { class: 'settings-card' },
        element('h3', {}, 'License'),
        element('p', {}, LICENSE),
        element('h3', {}, 'Links'),
        element('ul', { class: 'about-list' }, ...ABOUT_LINKS.map(linkItem)),
      ),
    ),
  ]
}

function priorityItem ({ name, description, badge: kind, chromeNote }: PriorityTier): HTMLLIElement {
  return element('li', {},
    element('strong', {}, name),
    ...(kind === undefined ? [] : chromeBadge(kind)),
    element('p', {}, description),
    ...(chromeNote === undefined ? [] : [chromeOnly(element('p', { class: 'help' }, chromeNote))]),
  )
}

function featureItems (): HTMLLIElement[] {
  return [
    element('li', {}, 'Proxy list'),
    element('li', {}, 'Per-tab proxy assignment', ...chromeBadge('firefox')),
    element('li', {}, 'Domain-based overrides', ...chromeBadge('limited')),
    element('li', {}, 'Flexible matching rules with bypass and force patterns'),
    element('li', {}, 'Bypass by request type', ...chromeBadge('firefox')),
    element('li', {}, 'Optional keep-alive monitoring for proxies', ...chromeBadge('firefox')),
    element('li', {}, 'Network inspection with a collapsible usage tree and auto-refresh'),
  ]
}

function chromeOnly<T extends Node> (node: T): T | null {
  return supportsProxyOnRequest ? null : node
}

function chromeBadge (kind: BadgeKind): Child[] {
  return supportsProxyOnRequest ? [] : [' ', badge(kind)]
}

function linkItem ({ label, href }: AboutLink): HTMLLIElement {
  return element('li', {}, element('a', { href, target: '_blank', rel: 'noopener' }, label))
}
