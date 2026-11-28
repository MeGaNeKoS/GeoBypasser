import { setAsideOnlyHashFor } from '../shell/routes'
import { button } from './button'
import { banner } from './feedback'
import { setAsideBanner } from './list-section'
import type { EmptyState } from './list-section'

export type SetAsideViewOptions = {
  sectionHash: string;
  noun: string;
  nounPlural: string;
  count: number;
  onlyShown: boolean;
}

const TOGGLE_FOCUS_KEY = 'set-aside-toggle'

export function setAsideBanners (options: SetAsideViewOptions): Node[] {
  if (options.onlyShown) {
    return [banner({
      tone: 'warn',
      text: `Only the ${options.nounPlural} that are not used are shown.`,
      action: showAllButton(options, 'quiet'),
    })]
  }
  if (options.count === 0) return []
  return [setAsideBanner(options.count, options.noun, options.nounPlural,
    button('Show only these', { variant: 'quiet', focusKey: TOGGLE_FOCUS_KEY, onClick: () => showOnly(options) }))]
}

export function nothingLeftToFix (options: SetAsideViewOptions): EmptyState {
  return {
    title: 'Nothing left to fix.',
    text: '',
    actions: [showAllButton(options)],
  }
}

function showAllButton (options: SetAsideViewOptions, variant?: 'quiet'): HTMLButtonElement {
  return button(`Show all ${options.nounPlural}`, { variant, focusKey: TOGGLE_FOCUS_KEY, onClick: () => showAll(options) })
}

function showOnly (options: SetAsideViewOptions): void {
  location.hash = setAsideOnlyHashFor(options.sectionHash)
}

function showAll (options: SetAsideViewOptions): void {
  location.hash = `#${options.sectionHash}`
}
