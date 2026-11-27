import { countPhrase, keepAliveRulesPhrase } from '@utils/homeView'
import type { GetStartedState, HomeStatus, HomeView, ProxiesSummary, RouteRow, SetAsideLink, SetAsideSummary } from '@utils/homeView'
import { badge } from '../components/feedback'
import { button, buttonGroup } from '../components/button'
import type { ButtonVariant } from '../components/button'
import { element } from '../dom'
import type { Child } from '../dom'
import { icon } from '../icons'

type ActionOptions = {
  variant?: ButtonVariant
  disabled?: boolean
}

export function statusCard (status: HomeStatus, setAside: SetAsideSummary): HTMLElement {
  return element('div', { class: 'home-card home-status' },
    element('p', { class: 'home-status__line', role: 'status' }, icon(status.tone === 'ok' ? 'check' : 'info'), status.sentence),
    setAside.total > 0 ? setAsideLine(setAside) : null,
  )
}

function setAsideLine (setAside: SetAsideSummary): HTMLElement {
  return element('p', { class: 'home-status__fix' }, icon('alert'), setAside.sentence, ' ', ...linkList(setAside.links))
}

function linkList (links: SetAsideLink[]): Child[] {
  return links.flatMap((link, index) => [index > 0 ? ', ' : null, linkOrText(link)])
}

function linkOrText (link: SetAsideLink): Child {
  return link.section ? sectionLink(link.section, link.label) : link.label
}

export function quickActions (sitesShown: boolean): HTMLElement {
  return buttonGroup(
    actionButton('Add rule', 'rules', null, { variant: 'primary' }),
    actionButton('Add proxy', 'proxies', null),
    ...(sitesShown ? [actionButton('Add site', 'sites', 'addOverride')] : []),
    actionButton('Import', 'import-export', 'importConfigBtn'),
    actionButton('Browse community rules', 'import-export', 'openCommunityImport'),
  )
}

export function getStartedCard (view: HomeView): HTMLElement {
  const { proxyAdded, choiceMade } = view.getStarted
  return element('div', { class: 'home-card' },
    element('h3', { class: 'group-label' }, 'Get started'),
    element('ol', { class: 'home-steps' },
      setupStep(1, 'Add a proxy', 'A server your traffic can go through.', proxyAdded, [
        actionButton('Add proxy', 'proxies', null, { variant: 'primary' }),
        actionButton('Import a file', 'proxies', null),
        actionButton('Browse community rules', 'import-export', 'openCommunityImport'),
      ]),
      setupStep(2, 'Choose what uses it', 'A rule for matching requests, one site, or everything by default.', choiceMade, [
        actionButton('Add a rule', 'rules', null, { disabled: !proxyAdded }),
        ...(view.sitesShown ? [actionButton('Add a site', 'sites', 'addOverride', { disabled: !proxyAdded })] : []),
        actionButton('Set a default', 'defaults', null, { disabled: !proxyAdded }),
      ], proxyAdded ? undefined : 'Add a proxy first.'),
      setupStep(3, 'Check it works', 'Test a proxy. Then open a site and look at the popup.', false, [
        actionButton('Test a proxy', 'test', null),
      ]),
    ),
  )
}

function setupStep (number: number, title: string, text: string, done: boolean, actions: Child[], note?: string): HTMLElement {
  return element('li', { class: 'home-step' },
    element('span', { class: 'home-step__number' }, String(number)),
    element('div', {},
      element('p', { class: 'home-step__title' }, title, done ? element('span', { class: 'home-step__done' }, icon('check'), ' Done') : null),
      element('p', { class: 'home-muted' }, text),
      buttonGroup(...actions),
      note ? element('p', { class: 'home-muted' }, note) : null,
    ),
  )
}

export function routesCard (view: HomeView): HTMLElement {
  return element('div', { class: 'home-card home-routes' },
    element('h3', { class: 'group-label' }, 'Where your traffic goes'),
    element('p', { class: 'home-muted' }, 'Top wins.'),
    element('ol', { class: 'home-routes__list' },
      ...view.routes.map(row => element('li', {}, routeItem(row))),
    ),
    element('p', { class: 'home-muted' }, sectionLink('defaults', view.failureNote)),
  )
}

function routeItem (row: RouteRow): HTMLElement {
  const content: Child[] = [
    element('span', { class: 'home-route__main' },
      element('span', { class: 'home-route__label' }, row.label),
      row.badge ? badge(row.badge) : null,
      row.value ? element('span', { class: 'home-route__value' }, row.value) : null,
      row.section ? icon('chevron-right') : null,
    ),
    routeDetail(row),
  ]
  return row.section
    ? element('a', { class: 'home-route', href: `#${row.section}` }, ...content)
    : element('div', { class: 'home-route' }, ...content)
}

function routeDetail (row: RouteRow): HTMLElement | null {
  if (!row.note && !row.fixNote) return null
  return element('span', { class: 'home-route__detail' },
    row.note ? element('span', { class: 'home-muted' }, row.note) : null,
    row.fixNote ? element('span', { class: 'home-route__fix' }, icon('alert'), row.fixNote) : null,
  )
}

export function proxiesCard (summary: ProxiesSummary): HTMLElement {
  return element('div', { class: 'home-card home-proxies' },
    element('h3', { class: 'group-label' }, 'Proxies'),
    element('p', {}, countPhrase(summary.count, 'proxy', 'proxies'), ' ', summary.fixNote ? element('span', { class: 'home-route__fix' }, icon('alert'), summary.fixNote) : null),
    element('p', {}, `Keep-alive: ${keepAliveRulesPhrase(summary.keepAliveRules)}`, ' ', summary.keepAliveBadge ? badge(summary.keepAliveBadge) : null),
    element('p', {}, `Notify if down: ${summary.notifyIfDown > 0 ? `on for ${summary.notifyIfDown}` : 'off'}`),
    element('p', { class: 'home-proxies__links' },
      sectionLink('proxies', 'Manage proxies'),
      sectionLink('keep-alive', 'Keep-alive'),
      sectionLink('test', 'Test a proxy'),
    ),
  )
}

export function welcomeText (): HTMLElement {
  return element('p', { class: 'home-muted' }, 'Send some of your traffic through a proxy and leave the rest direct.')
}

function actionButton (label: string, section: string, controlId: string | null, options: ActionOptions = {}): HTMLButtonElement {
  return button(label, {
    variant: options.variant,
    disabled: options.disabled,
    onClick: () => openSection(section, controlId),
  })
}

function openSection (section: string, controlId: string | null): void {
  location.hash = `#${section}`
  if (controlId) document.getElementById(controlId)?.click()
}

function sectionLink (section: string, label: string): HTMLAnchorElement {
  return element('a', { class: 'home-link', href: `#${section}` }, label)
}
