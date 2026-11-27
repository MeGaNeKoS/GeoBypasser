export type Child = Node | string | false | null | undefined

export type Attributes = Record<string, string | number | boolean | EventListener | undefined>

export function element<K extends keyof HTMLElementTagNameMap> (
  tag: K,
  attributes: Attributes = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [name, value] of Object.entries(attributes)) applyAttribute(node, name, value)
  node.append(...children.filter(isRenderable))
  return node
}

function applyAttribute (node: HTMLElement, name: string, value: Attributes[string]): void {
  if (value === undefined || value === false) return
  if (typeof value === 'function') {
    node.addEventListener(name.replace(/^on/, ''), value)
    return
  }
  node.setAttribute(name, value === true ? '' : String(value))
}

function isRenderable (child: Child): child is Node | string {
  return child !== false && child !== null && child !== undefined
}

export function requireElement (id: string): HTMLElement {
  const node = document.getElementById(id)
  if (!node) throw new Error(`Missing element #${id}`)
  return node
}

export function replaceContent (container: Element, children: Node[], focusKey?: string): void {
  const restoreKey = focusKey ?? focusedKey()
  container.replaceChildren(...children)
  if (restoreKey === undefined) return
  container.querySelector<HTMLElement>(`[data-focus-key="${restoreKey}"]`)?.focus()
}

function focusedKey (): string | undefined {
  const active = document.activeElement
  return active instanceof HTMLElement ? active.dataset.focusKey : undefined
}
