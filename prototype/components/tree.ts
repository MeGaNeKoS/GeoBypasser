import { element } from '../dom'
import { icon } from '../icons'
import type { NetworkNode } from '../model'

export function usageTree (nodes: NetworkNode[]): HTMLDivElement {
  return element('div', { class: 'tree', role: 'tree', 'aria-label': 'Network usage' },
    ...nodes.map(node => treeNode(node)),
  )
}

function treeNode (node: NetworkNode): HTMLElement {
  const summary = element('summary', {},
    treeName(node),
    figure('Sent', node.sent),
    figure('Received', node.received),
  )
  if (node.children.length === 0) {
    return element('details', { class: 'tree__leaf', open: true }, summary)
  }
  return element('details', { open: true },
    summary,
    element('div', { class: 'tree__children' }, ...node.children.map(child => treeNode(child))),
  )
}

function treeName (node: NetworkNode): HTMLElement {
  const marker = node.children.length > 0
    ? icon('chevron-down')
    : element('span', { class: 'tree__spacer', 'aria-hidden': 'true' })
  return element('span', { class: 'tree__name' }, marker, element('span', { class: 'mono' }, node.name))
}

function figure (label: string, value: string): HTMLElement {
  return element('span', { class: 'tree__numbers' }, `${label} `, element('span', { class: 'mono' }, value))
}
