import { supportsProxyOnRequest } from '@utils/env'
import { homeViewFor } from '@utils/homeView'
import type { HomeInput, HomeView } from '@utils/homeView'
import { getConfig, getTabProxyMap } from '@utils/storage'
import { button } from '../components/button'
import { stateBlock } from '../components/feedback'
import { element, replaceContent, requireElement } from '../dom'
import { readProxyControlState } from '../proxyControlState'
import { getStartedCard, proxiesCard, quickActions, routesCard, statusCard, welcomeText } from './homeCards'

const HOME_CONTAINER_ID = 'homeContent'
const LOADING_DELAY_MS = 150
const LOADING_STATUS_BARS = 1
const LOADING_CARD_BARS = 4

export async function renderHome (): Promise<void> {
  const container = requireElement(HOME_CONTAINER_ID)
  const loadingTimer = window.setTimeout(() => showLoading(container), LOADING_DELAY_MS)
  try {
    const view = homeViewFor(await loadHomeInput())
    replaceContent(container, [homeBody(view)])
  } catch (error) {
    replaceContent(container, [loadErrorState(error)])
  } finally {
    window.clearTimeout(loadingTimer)
    container.removeAttribute('aria-busy')
  }
}

function showLoading (container: HTMLElement): void {
  if (container.hasChildNodes()) return
  container.setAttribute('aria-busy', 'true')
  replaceContent(container, [loadingBody()])
}

async function loadHomeInput (): Promise<HomeInput> {
  const [settings, tabProxyMap, control] = await Promise.all([getConfig(), getTabProxyMap(), readProxyControlState()])
  return {
    settings,
    tabProxyMap,
    browser: supportsProxyOnRequest ? 'firefox' : 'chrome',
    control,
  }
}

function homeBody (view: HomeView): HTMLElement {
  return element('div', { class: 'home' },
    element('h2', {}, view.case === 'firstTime' ? 'Welcome to GeoBypass' : 'Home'),
    view.case === 'firstTime' ? welcomeText() : null,
    view.status ? statusCard(view.status, view.setAside) : null,
    view.case === 'setUp' ? null : getStartedCard(view),
    view.case === 'firstTime' ? null : quickActions(view.sitesShown),
    view.case === 'firstTime' ? null : element('div', { class: 'home-grid' }, routesCard(view), proxiesCard(view.proxies)),
  )
}

function loadingBody (): HTMLElement {
  return element('div', { class: 'home' },
    element('h2', {}, 'Home'),
    element('p', { class: 'visually-hidden', role: 'status' }, 'Loading your settings'),
    element('div', { class: 'home-card' }, loadingBars(LOADING_STATUS_BARS)),
    element('div', { class: 'home-grid' }, loadingCard(), loadingCard()),
  )
}

function loadingCard (): HTMLElement {
  return element('div', { class: 'home-card' }, loadingBars(LOADING_CARD_BARS))
}

function loadingBars (count: number): HTMLElement {
  return element('div', { class: 'home-loading' },
    ...Array.from({ length: count }, () => element('span', { class: 'skeleton__bar', 'aria-hidden': 'true' })),
  )
}

function loadErrorState (error: unknown): HTMLElement {
  return element('div', { class: 'home' },
    element('h2', {}, 'Home'),
    stateBlock({
      tone: 'danger',
      title: 'Could not load your settings',
      text: `The saved settings could not be read: ${errorMessage(error)}`,
      action: button('Try again', { onClick: () => { void renderHome() } }),
    }),
  )
}

function errorMessage (error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
