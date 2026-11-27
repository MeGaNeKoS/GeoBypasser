import { element, type Child } from '../dom'
import { icon, type IconName } from '../icons'

export type BadgeKind = 'not-used' | 'ignored' | 'unavailable' | 'firefox' | 'limited'

const BADGE_TEXT: Record<BadgeKind, string> = {
  'not-used': 'Not used',
  ignored: 'Setting ignored',
  unavailable: 'Proxy unavailable',
  firefox: 'Firefox only',
  limited: 'Limited on Chrome',
}

const BADGE_CLASS: Record<BadgeKind, string> = {
  'not-used': 'badge badge--warn',
  ignored: 'badge badge--muted',
  unavailable: 'badge badge--danger',
  firefox: 'badge badge--muted',
  limited: 'badge badge--muted',
}

const BADGE_ICON: Record<BadgeKind, IconName> = {
  'not-used': 'alert',
  ignored: 'info',
  unavailable: 'unlink',
  firefox: 'info',
  limited: 'info',
}

export function badge (kind: BadgeKind): HTMLSpanElement {
  return element('span', { class: BADGE_CLASS[kind] }, icon(BADGE_ICON[kind]), BADGE_TEXT[kind])
}

export function countBadge (count: number | string): HTMLSpanElement {
  return element('span', { class: 'badge' }, String(count))
}

export type Tone = 'info' | 'warn' | 'danger'

const TONE_ICON: Record<Tone, IconName> = { info: 'info', warn: 'alert', danger: 'alert' }

export type BannerOptions = {
  tone: Tone;
  text: Child;
  action?: Node;
}

export function banner (options: BannerOptions): HTMLDivElement {
  const role = options.tone === 'danger' ? 'alert' : 'status'
  return element('div', { class: `banner banner--${options.tone}`, role },
    icon(TONE_ICON[options.tone]),
    element('div', { class: 'banner__text' }, options.text),
    options.action,
  )
}

export function statusLine (text: string, tone: 'info' | 'danger' = 'info'): HTMLParagraphElement {
  const classes = tone === 'danger' ? 'status-line status-line--error' : 'status-line'
  return element('p', { class: classes, role: 'status', 'aria-live': 'polite' }, text)
}

export type StateBlockOptions = {
  title: string;
  text?: string;
  action?: Node;
  tone?: 'info' | 'danger';
}

export function stateBlock (options: StateBlockOptions): HTMLDivElement {
  const isError = options.tone === 'danger'
  return element('div', { class: 'state-block', role: isError ? 'alert' : undefined },
    element('p', { class: 'state-block__title' }, isError ? icon('alert') : null, options.title),
    options.text ? element('p', { class: 'help' }, options.text) : null,
    options.action,
  )
}

export function skeletonRows (count: number): HTMLDivElement {
  const rows = Array.from({ length: count }, () => skeletonRow())
  return element('div', { class: 'skeleton', 'aria-busy': 'true', role: 'status' },
    element('span', { class: 'visually-hidden' }, 'Loading'),
    ...rows,
  )
}

function skeletonRow (): HTMLDivElement {
  return element('div', { class: 'row skeleton__row', 'aria-hidden': 'true' },
    element('span', { class: 'skeleton__box' }),
    element('div', { class: 'row__body' },
      element('div', { class: 'skeleton__line-box skeleton__line-box--control' },
        element('span', { class: 'skeleton__bar' }),
      ),
      element('div', { class: 'skeleton__line-box' },
        element('span', { class: 'skeleton__bar skeleton__bar--short' }),
      ),
      element('div', { class: 'skeleton__line-box skeleton__line-box--narrow-only' },
        element('span', { class: 'skeleton__bar skeleton__bar--wide' }),
      ),
    ),
    element('div', { class: 'row__actions' },
      element('span', { class: 'skeleton__button' }),
      element('span', { class: 'skeleton__button' }),
    ),
  )
}
