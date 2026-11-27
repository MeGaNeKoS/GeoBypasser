import { element, replaceContent } from '../dom'
import type { ListState } from '../model'
import { button } from './button'
import { banner, skeletonRows, stateBlock, statusLine } from './feedback'

export function setAsideBanner (count: number, noun: string, nounPlural: string, action?: Node): HTMLDivElement {
  const subject = count === 1 ? `1 ${noun} is` : `${count} ${nounPlural} are`
  return banner({ tone: 'warn', text: `${subject} not used because ${count === 1 ? 'it is' : 'they are'} invalid.`, action })
}

export type ListRow = {
  id: string;
  name: string;
  setAside: boolean;
  body: Node[];
  actions: Node[];
}

export type EmptyState = {
  title: string;
  text: string;
  actions: Node[];
}

export type ListSectionOptions = {
  title: string;
  help: string;
  noun: string;
  nounPlural: string;
  addLabel: string;
  state: ListState;
  rows: ListRow[];
  empty: EmptyState;
  banners?: Node[];
  titleBadge?: Node;
  toolbarExtras?: Node[];
  onAdd: () => void;
  onImport: () => void;
  onRetry: () => void;
  onRemove: (ids: string[]) => void;
  onExport: (ids: string[]) => string;
}

export function listSection (options: ListSectionOptions): HTMLElement {
  const writable = options.state === 'populated' || options.state === 'empty'
  return element('section', { class: 'list-section' },
    element('header', { class: 'list-section__header' },
      element('div', { class: 'list-section__header-text' },
        element('div', { class: 'list-section__title' },
          element('h2', { class: 'page-title' }, options.title),
          options.titleBadge ?? null,
        ),
        element('p', { class: 'help' }, options.help),
      ),
      button(options.addLabel, { variant: 'primary', disabled: !writable, onClick: options.onAdd }),
    ),
    new ListRegion(options).node,
  )
}

const selectionByList = new Map<string, Set<string>>()

export function clearSelections (): void {
  selectionByList.clear()
}

function selectionFor (title: string): Set<string> {
  const existing = selectionByList.get(title)
  if (existing) return existing
  const created = new Set<string>()
  selectionByList.set(title, created)
  return created
}

class ListRegion {
  readonly node: HTMLDivElement
  private readonly options: ListSectionOptions
  private readonly selected: Set<string>
  private pendingRemoval: string | 'selection' | null = null
  private exportNotice = ''

  constructor (options: ListSectionOptions) {
    this.options = options
    this.selected = selectionFor(options.title)
    this.node = element('div', { class: 'stack' })
    this.render()
  }

  private selectedIds (): string[] {
    return this.options.rows.map(row => row.id).filter(id => this.selected.has(id))
  }

  private render (focusKey?: string): void {
    replaceContent(this.node, this.content(), focusKey)
  }

  private content (): Node[] {
    if (this.options.state === 'loading') return [skeletonRows(3)]
    if (this.options.state === 'error') return [this.errorState()]
    if (this.options.rows.length === 0) return [this.emptyState()]
    return this.populated()
  }

  private populated (): Node[] {
    const nodes: Node[] = []
    nodes.push(...this.options.banners ?? [])
    nodes.push(this.toolbar(), this.rowList())
    if (this.exportNotice) nodes.push(statusLine(this.exportNotice))
    return nodes
  }

  private errorState (): HTMLElement {
    const retry = button('Try again', { onClick: this.options.onRetry })
    return stateBlock({
      tone: 'danger',
      title: `Could not load your ${this.options.nounPlural}`,
      text: 'The saved settings could not be read.',
      action: retry,
    })
  }

  private emptyState (): HTMLElement {
    const { title, text, actions } = this.options.empty
    return stateBlock({ title, text, action: element('div', { class: 'button-row' }, ...actions) })
  }

  private toolbar (): HTMLElement {
    const ids = this.options.rows.map(row => row.id)
    const allSelected = ids.every(id => this.selected.has(id))
    const selectAll = element('label', { class: 'checkbox' },
      element('input', {
        type: 'checkbox',
        checked: allSelected,
        'data-focus-key': 'select-all',
        onchange: (event: Event) => this.setSelection(ids, (event.target as HTMLInputElement).checked),
      }),
      'Select all',
    )
    return element('div', { class: 'toolbar' },
      selectAll,
      button('Import', { onClick: this.options.onImport }),
      button('Export all', { onClick: () => this.exportIds(ids) }),
      ...this.options.toolbarExtras ?? [],
      this.selectionControls(),
    )
  }

  private selectionControls (): Node | null {
    const ids = this.selectedIds()
    if (ids.length === 0) return null
    const count = ids.length
    if (this.pendingRemoval === 'selection') {
      return this.confirm(`Delete ${count} ${count === 1 ? this.options.noun : this.options.nounPlural}?`, ids, 'selection')
    }
    return element('div', { class: 'button-row' },
      element('span', { class: 'toolbar__selection' }, `${count} selected`),
      button('Export selected', { onClick: () => this.exportIds(ids) }),
      button('Delete selected', { onClick: () => this.askRemoval('selection') }),
    )
  }

  private rowList (): HTMLUListElement {
    return element('ul', { class: 'rows' }, ...this.options.rows.map(row => this.rowItem(row)))
  }

  private rowItem (row: ListRow): HTMLLIElement {
    const select = element('input', {
      type: 'checkbox',
      'aria-label': `Select ${row.name}`,
      checked: this.selected.has(row.id),
      'data-focus-key': `select-${row.id}`,
      onchange: (event: Event) => this.setSelection([row.id], (event.target as HTMLInputElement).checked),
    })
    return element('li', { class: row.setAside ? 'row row--set-aside' : 'row' },
      select,
      element('div', { class: 'row__body' }, ...row.body),
      element('div', { class: 'row__actions' }, ...this.rowActions(row)),
    )
  }

  private rowActions (row: ListRow): Node[] {
    if (this.pendingRemoval === row.id) {
      return [this.confirm(`Delete this ${this.options.noun}?`, [row.id], row.id)]
    }
    return [...row.actions, button('Delete', { onClick: () => this.askRemoval(row.id) })]
  }

  private confirm (question: string, ids: string[], pendingKey: string): HTMLElement {
    const cancelKey = `cancel-${pendingKey}`
    return element('div', { class: 'inline-confirm', role: 'group', 'aria-label': 'Confirm delete' },
      element('span', { class: 'inline-confirm__question' }, question),
      button('Delete', { variant: 'danger', onClick: () => this.remove(ids) }),
      button('Cancel', { focusKey: cancelKey, onClick: () => this.cancelRemoval(pendingKey) }),
    )
  }

  private askRemoval (target: string | 'selection'): void {
    this.pendingRemoval = target
    this.render(target === 'selection' ? 'cancel-selection' : `cancel-${target}`)
  }

  private cancelRemoval (pendingKey: string): void {
    this.pendingRemoval = null
    this.render(pendingKey === 'selection' ? 'delete-selected' : `delete-${pendingKey}`)
  }

  private remove (ids: string[]): void {
    this.pendingRemoval = null
    this.selected.clear()
    this.options.onRemove(ids)
  }

  private exportIds (ids: string[]): void {
    this.exportNotice = this.options.onExport(ids)
    this.render()
  }

  private setSelection (ids: string[], selected: boolean): void {
    for (const id of ids) {
      if (selected) this.selected.add(id)
      else this.selected.delete(id)
    }
    this.render(ids.length === 1 ? `select-${ids[0]}` : 'select-all')
  }
}

