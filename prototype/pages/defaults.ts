import { element } from '@ui/dom'
import { button } from '@ui/components/button'
import { switchControl } from '@ui/components/controls'
import { badge, skeletonRows, stateBlock } from '@ui/components/feedback'
import { textField } from '@ui/components/fields'
import { otherExtensionsNote } from '../components/other-extensions-note'
import { proxySelect } from '../components/proxy-select'
import { draftFlag, draftValue, readDraft } from '@ui/components/sheet'
import { defaults } from '../sample-data'
import type { Browser, ListState } from '../model'
import { isHttpUrl } from '../validation'
import type { SectionContext } from './section-context'

const TEST_URL_ERROR = 'Test URL must start with http:// or https://.'

let rejectedTestUrl: string | null = null

export function defaultsSection (context: SectionContext): HTMLElement {
  const { browser, listState } = context.store.get()
  return element('section', { class: 'stack' },
    element('header', { class: 'list-section__header' },
      element('div', { class: 'list-section__header-text' },
        element('h2', { class: 'page-title' }, 'Defaults'),
        element('p', { class: 'help' }, 'Used when a rule or site does not choose its own proxy.'),
      ),
    ),
    defaultsBody(browser, listState, context),
    otherExtensionsNote(browser),
  )
}

function defaultsBody (browser: Browser, listState: ListState, context: SectionContext): HTMLElement {
  if (listState === 'error') return errorState(context)
  if (listState === 'loading') return skeletonRows(3)
  return defaultsCard(browser, context)
}

function errorState (context: SectionContext): HTMLElement {
  return stateBlock({
    title: 'Could not read the defaults.',
    tone: 'danger',
    action: button('Try again', { onClick: () => context.refresh() }),
  })
}

function defaultsCard (browser: Browser, context: SectionContext): HTMLElement {
  const form = element('form', { class: 'card stack', novalidate: true },
    proxySelect({ name: 'defaultProxyId', label: 'Default proxy', selectedId: defaults.defaultProxyId, none: 'None', directChoice: false }),
    element('div', { class: 'field__row' },
      element('span', { class: 'field__label' }, 'If a proxy fails, connect directly'),
      switchControl('If a proxy fails, connect directly', defaults.fallbackDirect, () => persist(form, context), { field: 'fallbackDirect' }),
    ),
    textField({
      name: 'testUrl',
      label: 'Test URL',
      type: 'url',
      value: rejectedTestUrl ?? defaults.testUrl,
      help: 'Used by Test and keep-alive checks.',
      fault: rejectedTestUrl === null ? undefined : TEST_URL_ERROR,
    }),
    clearTabProxiesRow(browser, context),
  )
  form.addEventListener('change', () => persist(form, context))
  return form
}

function persist (form: HTMLFormElement, context: SectionContext): void {
  const draft = readDraft(form)
  const testUrl = draftValue(draft, 'testUrl')
  if (!isHttpUrl(testUrl)) {
    rejectedTestUrl = testUrl
    context.refresh()
    return
  }
  rejectedTestUrl = null
  defaults.defaultProxyId = draftValue(draft, 'defaultProxyId')
  defaults.fallbackDirect = draftFlag(draft, 'fallbackDirect')
  defaults.testUrl = testUrl
  context.refresh('Saved')
}

function clearTabProxiesRow (browser: Browser, context: SectionContext): HTMLElement {
  const isChrome = browser === 'chrome'
  const slot = element('div', { class: 'button-row' },
    button('Clear all tab proxies', {
      disabled: isChrome,
      onClick: () => confirmClear(slot, context),
    }),
  )
  return element('div', { class: 'stack' },
    element('span', { class: 'field__label' }, 'Tab proxies'),
    element('p', { class: 'help' }, isChrome ? badge('firefox') : null, isChrome ? ' Chrome cannot set a proxy per tab.' : 'Removes the proxy from every tab that has one set.'),
    slot,
  )
}

function confirmClear (slot: HTMLElement, context: SectionContext): void {
  slot.replaceChildren(
    element('div', { class: 'inline-confirm', role: 'group', 'aria-label': 'Confirm clear' },
      element('span', { class: 'inline-confirm__question' }, 'Clear the proxy on every tab?'),
      button('Clear', { variant: 'danger', onClick: () => context.refresh('Cleared all tab proxies.') }),
      button('Cancel', { focusKey: 'cancel-clear', onClick: () => context.refresh() }),
    ),
  )
  slot.querySelector<HTMLElement>('[data-focus-key="cancel-clear"]')?.focus()
}
