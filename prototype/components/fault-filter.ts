import { button } from '@ui/components/button'
import { setAsideBanner, type EmptyState } from '@ui/components/list-section'

export type FaultNoun = {
  noun: string;
  nounPlural: string;
}

export class FaultFilter {
  private showingOnly = false

  visible<T>(entries: T[], isSetAside: (entry: T) => boolean): T[] {
    return this.showingOnly ? entries.filter(isSetAside) : entries
  }

  isShowingOnly (): boolean {
    return this.showingOnly
  }

  toggle (): void {
    this.showingOnly = !this.showingOnly
  }
}

export function faultBanner (filter: FaultFilter, count: number, nouns: FaultNoun, refresh: () => void): HTMLDivElement {
  const toggle = button(filter.isShowingOnly() ? `Show all ${nouns.nounPlural}` : 'Show only these', {
    focusKey: 'toggle-fault-filter',
    onClick: () => {
      filter.toggle()
      refresh()
    },
  })
  return setAsideBanner(count, nouns.noun, nouns.nounPlural, toggle)
}

export function nothingLeftToFix (filter: FaultFilter, nouns: FaultNoun, refresh: () => void): EmptyState {
  return {
    title: 'Nothing left to fix.',
    text: '',
    actions: [button(`Show all ${nouns.nounPlural}`, {
      onClick: () => {
        filter.toggle()
        refresh()
      },
    })],
  }
}
