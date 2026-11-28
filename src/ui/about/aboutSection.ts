import browser from 'webextension-polyfill'
import { supportsProxyOnRequest } from '@utils/env'
import { badge } from '../components/feedback'
import type { BadgeKind } from '../components/feedback'
import { otherExtensionsNote } from '../components/other-extensions-note'
import { element, replaceContent, requireElement } from '../dom'
import type { Child } from '../dom'

const ABOUT_CONTAINER_ID = 'aboutContent'
const HEADING = 'About'
const LICENSE = 'Mozilla Public License 2.0'
const OTHER_EXTENSIONS_DETAIL = 'Requests that no tab proxy, site proxy, rule or default proxy applies to are left untouched, so another extension may route them.'
const CHROME_SITE_SCOPE = 'On Chrome this covers requests to the site and its subdomains only.'

type AboutLink = { label: string; href: string }

const ABOUT_LINKS: AboutLink[] = [
  { label: 'Project Repository', href: 'https://github.com/MeGaNeKoS/GeoBypasser' },
  { label: 'Known Website Bypass Rules and Community Proxies', href: 'https://github.com/MeGaNeKoS/GeoBypass-Rules' },
  { label: 'Support on Ko-fi', href: 'https://ko-fi.com/meganeko__' },
  { label: 'Support on Patreon', href: 'https://www.patreon.com/c/__meganeko__' },
]

export function renderAboutSection (): void {
  replaceContent(requireElement(ABOUT_CONTAINER_ID), aboutContent())
}

function aboutContent (): Node[] {
  const { name, version, description } = browser.runtime.getManifest()
  return [
    element('h2', { class: 'page-title', tabindex: '-1' }, HEADING),
    element('div', { class: 'settings-card' },
      element('p', {}, element('strong', {}, name), ` version ${version}`),
      element('p', {}, description ?? ''),
    ),
    element('div', { class: 'settings-card' },
      element('h3', {}, 'Rule Priority'),
      element('ol', {}, ...priorityItems()),
      ...(supportsProxyOnRequest ? [otherExtensionsNote(OTHER_EXTENSIONS_DETAIL)] : []),
    ),
    element('div', { class: 'settings-card' },
      element('h3', {}, 'Features'),
      element('ul', {}, ...featureItems()),
    ),
    element('div', { class: 'settings-card' },
      element('h3', {}, 'License'),
      element('p', {}, LICENSE),
      element('h3', {}, 'Links'),
      element('ul', {}, ...ABOUT_LINKS.map(linkItem)),
    ),
  ]
}

function priorityItems (): HTMLLIElement[] {
  return [
    element('li', {}, 'Tab specific rule: if a tab is assigned a proxy it takes priority.', ...chromeBadge('firefox')),
    element('li', {},
      "Main site rule: if the tab URL's domain matches a configured rule the proxy from that rule is used.",
      ...chromeBadge('limited'),
      chromeOnly(element('p', { class: 'help' }, CHROME_SITE_SCOPE)),
    ),
    element('li', {}, 'Request domain rule: existing rules that match the request URL.'),
    element('li', {}, 'Default proxy: used when no other rule matches.'),
    element('li', {}, 'Direct connection otherwise.'),
  ]
}

function featureItems (): Array<HTMLLIElement | null> {
  return [
    supportsProxyOnRequest ? element('li', {}, 'Proxy list with per-tab assignment') : null,
    element('li', {}, 'Domain-based overrides', ...chromeBadge('limited')),
    element('li', {}, 'Flexible matching rules with bypass and force patterns'),
    element('li', {}, 'Bypass by request type', ...chromeBadge('firefox')),
    element('li', {}, 'Optional keep-alive monitoring for proxies'),
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
