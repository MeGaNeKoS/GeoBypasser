import { element, replaceContent } from '@ui/dom'
import { icon } from '@ui/icons'
import { dashboardNotRouting, ROUTING_AGAIN_TEXT, routingRestored } from '../components/not-routing'
import { statusLine } from '@ui/components/feedback'
import { clearSelections } from '@ui/components/list-section'
import { saveFailureBanner } from '../components/save-failure'
import type { PrototypeState } from '../model'
import { keepAliveRules, proxies, rules, sites } from '../sample-data'
import type { Store } from '../store'
import { aboutSection } from './about'
import { defaultsSection } from './defaults'
import { importExportSection } from './import-export'
import { keepAliveSection } from './keep-alive'
import { networkSection } from './network'
import { proxiesSection, resetPasswordReveal } from './proxies'
import { rulesSection } from './rules'
import type { SectionContext } from './section-context'
import { sitesSection } from './sites'
import { testSection } from './test'

type SectionDef = {
  id: string;
  label: string;
  group: 'Set up' | 'Tools';
  render: (context: SectionContext) => Node;
  count?: () => number;
  attention?: () => number;
}

const SECTIONS: SectionDef[] = [
  { id: 'proxies', label: 'Proxies', group: 'Set up', render: proxiesSection, count: () => proxies.length, attention: () => proxies.filter(proxy => proxy.faults.length > 0).length },
  { id: 'rules', label: 'Rules', group: 'Set up', render: rulesSection, count: () => rules.length, attention: () => rules.filter(rule => rule.faults.length > 0).length },
  { id: 'sites', label: 'Sites', group: 'Set up', render: sitesSection, count: () => sites.length, attention: () => sites.filter(site => site.faults.length > 0).length },
  { id: 'keep-alive', label: 'Keep-alive', group: 'Set up', render: keepAliveSection, count: () => keepAliveRules.length, attention: () => keepAliveRules.filter(rule => rule.faults.length > 0).length },
  { id: 'defaults', label: 'Defaults', group: 'Set up', render: defaultsSection },
  { id: 'test', label: 'Test', group: 'Tools', render: testSection },
  { id: 'network', label: 'Network', group: 'Tools', render: networkSection },
  { id: 'import-export', label: 'Import and export', group: 'Tools', render: importExportSection },
  { id: 'about', label: 'About', group: 'Tools', render: aboutSection },
]

export function mountDashboard (root: HTMLElement, store: Store<PrototypeState>): void {
  const top = element('header', { class: 'dash-top' })
  const nav = element('nav', { class: 'dash-nav', id: 'dash-nav', 'aria-label': 'Sections' })
  const main = element('main', { class: 'dash-main', id: 'dash-main' })
  root.replaceChildren(top, nav, main)

  let menuOpen = false
  let notice = ''

  function refresh (message?: string): void {
    notice = message ?? notice
    renderAll()
  }

  function renderAll (): void {
    const active = activeSection()
    const { browser, proxyControl } = store.get()
    renderTop(top, active)
    renderNav(nav, { active, open: menuOpen })
    const content: Node[] = []
    if (store.get().saveFailed) content.push(saveFailureBanner(store))
    const warning = dashboardNotRouting(browser, proxyControl)
    if (warning) content.push(warning)
    content.push(active.render({ store, refresh }))
    if (notice) content.push(statusLine(notice))
    replaceContent(main, content)
  }

  function renderTop (host: HTMLElement, active: SectionDef): void {
    const toggle = element('button', {
      type: 'button',
      class: 'button dash-top__section',
      'aria-expanded': String(menuOpen),
      'aria-controls': 'dash-nav',
      'data-focus-key': 'menu-toggle',
      onclick: () => {
        menuOpen = !menuOpen
        renderAll()
      },
    }, icon('menu'), element('span', { class: 'dash-top__label' }, active.label), icon(menuOpen ? 'chevron-up' : 'chevron-down'))
    replaceContent(host, [element('span', { class: 'dash-top__brand' }, 'GeoBypass'), toggle])
  }

  let previousControl = store.get().proxyControl
  store.subscribe(() => {
    const { browser, proxyControl } = store.get()
    if (routingRestored(browser, previousControl, proxyControl)) notice = ROUTING_AGAIN_TEXT
    previousControl = proxyControl
    renderAll()
  })
  window.addEventListener('hashchange', () => {
    notice = ''
    menuOpen = false
    resetPasswordReveal()
    clearSelections()
    renderAll()
  })
  renderAll()
}

function activeSection (): SectionDef {
  const id = window.location.hash.replace(/^#/, '')
  return SECTIONS.find(section => section.id === id) ?? SECTIONS[0]
}

type NavState = {
  active: SectionDef;
  open: boolean;
}

function renderNav (host: HTMLElement, state: NavState): void {
  host.classList.toggle('dash-nav--open', state.open)
  const groups = (['Set up', 'Tools'] as const).map(group => element('div', { class: 'dash-nav__group' },
    element('p', { class: 'dash-nav__label' }, group),
    ...SECTIONS.filter(section => section.group === group).map(section => navLink(section, section.id === state.active.id)),
  ))
  replaceContent(host, [element('p', { class: 'dash-nav__brand' }, 'GeoBypass'), ...groups])
}

function navLink (section: SectionDef, current: boolean): HTMLAnchorElement {
  const counted = section.count !== undefined
  return element('a', {
    href: `#${section.id}`,
    class: 'dash-nav__link',
    'aria-current': current ? 'page' : undefined,
    'data-focus-key': `nav-${section.id}`,
  },
  element('span', { class: counted ? 'dash-nav__text' : 'dash-nav__text dash-nav__text--full' }, section.label),
  counted ? element('span', { class: 'nav-count' }, String(section.count?.())) : null,
  counted ? element('span', { class: 'dash-nav__slot' }, navSlotContent(section)) : null,
  )
}

function navSlotContent (section: SectionDef): Node | null {
  if (section.attention && section.attention() > 0) return attentionBadge(section.attention())
  return null
}

function attentionBadge (count: number): HTMLSpanElement {
  return element('span', { class: 'dash-nav__badge dash-nav__badge--fix', role: 'img', 'aria-label': `${count} need fixing` },
    icon('alert'),
    String(count),
  )
}
