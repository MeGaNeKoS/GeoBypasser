import browser from 'webextension-polyfill'
import { getConfig } from '@utils/storage'
import { needsFixingPhrase } from '@utils/homeView'
import { navCounts } from '@utils/pageView'
import type { NavCount, NavCounts } from '@utils/pageView'
import { element, replaceContent, requireElement } from '../dom'
import { renderHome } from '../home/home'
import { icon, installSprite } from '../icons'
import { renderProxySection } from '../proxies/proxySection'
import { HOME_SECTION_ID, PROXY_SECTION_ID, hashForSection, sectionIdForHash } from './routes'

export type FrameOptions = {
  onSectionShown?: (sectionId: string) => void
}

type FrameNav = {
  menu: HTMLElement
  menuToggle: HTMLElement
  buttons: HTMLButtonElement[]
}

const COMPACT_MENU_QUERY = '(max-width: 719.98px)'
const COUNTED_SECTIONS: Partial<Record<string, keyof NavCounts>> = {
  proxy: 'proxies',
  rules: 'rules',
  override: 'sites',
  keepalive: 'keepAlive',
}

export function mountDashboardFrame (options: FrameOptions = {}): void {
  installSprite()
  const menu = requireElement('tabs')
  const nav: FrameNav = {
    menu,
    menuToggle: requireElement('navToggle'),
    buttons: Array.from(menu.querySelectorAll<HTMLButtonElement>('button[data-tab]')),
  }
  const showCurrentHash = (): void => { void showSection(sectionIdForHash(location.hash), nav, options) }

  for (const button of nav.buttons) {
    button.addEventListener('click', () => chooseSection(sectionIdOf(button), showCurrentHash))
  }
  nav.menuToggle.addEventListener('click', () => toggleMenu(nav))
  document.addEventListener('keydown', event => closeMenuOnEscape(event, nav))
  window.addEventListener('hashchange', showCurrentHash)
  browser.storage.onChanged.addListener(() => { void refreshNavCounts(nav) })
  showCurrentHash()
  void refreshNavCounts(nav)
}

function chooseSection (sectionId: string, showCurrentHash: () => void): void {
  if (sectionIdForHash(location.hash) === sectionId) {
    showCurrentHash()
    return
  }
  location.hash = hashForSection(sectionId)
}

async function showSection (requestedId: string, nav: FrameNav, options: FrameOptions): Promise<void> {
  const menuWasOpen = nav.menu.classList.contains('open')
  const shownId = document.getElementById(requestedId) ? requestedId : HOME_SECTION_ID
  document.querySelectorAll<HTMLElement>('section.tab').forEach(section => {
    section.classList.toggle('active', section.id === shownId)
  })
  for (const button of nav.buttons) {
    const current = sectionIdOf(button) === shownId
    button.classList.toggle('active', current)
    if (current) button.setAttribute('aria-current', 'page')
    else button.removeAttribute('aria-current')
  }
  renderMenuToggle(nav.menuToggle, labelOf(nav.buttons.find(button => sectionIdOf(button) === shownId)) ?? shownId)
  closeMenuOnCompactScreen(nav)
  if (shownId === HOME_SECTION_ID) await renderHome()
  if (shownId === PROXY_SECTION_ID) await renderProxySection()
  if (menuWasOpen) focusSectionHeading(shownId)
  options.onSectionShown?.(shownId)
}

function focusSectionHeading (sectionId: string): void {
  const section = document.getElementById(sectionId)
  const heading = section?.querySelector<HTMLElement>('h2')
  if (!section?.classList.contains('active') || !heading) return
  heading.tabIndex = -1
  heading.focus()
}

async function refreshNavCounts (nav: FrameNav): Promise<void> {
  const counts = navCounts(await getConfig())
  for (const button of nav.buttons) {
    const key = COUNTED_SECTIONS[sectionIdOf(button)]
    if (key) renderNavCount(button, counts[key])
  }
}

function renderNavCount (button: HTMLButtonElement, count: NavCount): void {
  button.querySelectorAll('.nav-count, .nav-fixing').forEach(node => node.remove())
  button.append(element('span', { class: 'nav-count' }, String(count.count)))
  if (count.needsFixing > 0) {
    button.append(element('span', { class: 'nav-fixing', role: 'img', 'aria-label': needsFixingPhrase(count.needsFixing) },
      icon('alert'), String(count.needsFixing)))
  }
}

function sectionIdOf (button: HTMLButtonElement): string {
  return button.dataset.tab ?? HOME_SECTION_ID
}

function labelOf (button: HTMLButtonElement | undefined): string | undefined {
  return button?.querySelector('.nav-label')?.textContent ?? undefined
}

function renderMenuToggle (toggle: HTMLElement, label: string): void {
  replaceContent(toggle, [
    icon('menu'),
    element('span', { class: 'nav-toggle__label' }, label),
    element('span', { class: 'nav-toggle__chevron' }, icon('chevron-down')),
  ])
}

function toggleMenu (nav: FrameNav): void {
  setMenuOpen(nav, !nav.menu.classList.contains('open'))
}

function closeMenuOnCompactScreen (nav: FrameNav): void {
  if (!isCompactScreen()) return
  setMenuOpen(nav, false)
}

function closeMenuOnEscape (event: KeyboardEvent, nav: FrameNav): void {
  if (event.key !== 'Escape' || !isCompactScreen() || !nav.menu.classList.contains('open')) return
  setMenuOpen(nav, false)
  nav.menuToggle.focus()
}

function isCompactScreen (): boolean {
  return window.matchMedia(COMPACT_MENU_QUERY).matches
}

function setMenuOpen (nav: FrameNav, open: boolean): void {
  nav.menu.classList.toggle('open', open)
  nav.menuToggle.setAttribute('aria-expanded', String(open))
}
