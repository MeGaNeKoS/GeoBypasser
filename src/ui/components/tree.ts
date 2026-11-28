import { element } from '../dom'
import { icon } from '../icons'

export type TreeNode = {
  name: string;
  sent: string;
  received: string;
  children: TreeNode[];
}

export function usageTree (nodes: TreeNode[]): HTMLDivElement {
  return element('div', { class: 'tree', role: 'tree', 'aria-label': 'Network usage' },
    element('div', { class: 'tree__header', 'aria-hidden': 'true' },
      element('span', {}, 'Path'),
      element('span', { class: 'tree__numbers' }, 'Sent'),
      element('span', { class: 'tree__numbers' }, 'Received'),
    ),
    ...nodes.map(node => treeNode(node)),
  )
}

function treeNode (node: TreeNode): HTMLElement {
  const summary = element('summary', {},
    treeName(node),
    figure(node.sent),
    figure(node.received),
  )
  if (node.children.length === 0) {
    return element('details', { class: 'tree__leaf', open: true }, summary)
  }
  return element('details', { open: true },
    summary,
    element('div', { class: 'tree__children' }, ...node.children.map(child => treeNode(child))),
  )
}

function treeName (node: TreeNode): HTMLElement {
  const marker = node.children.length > 0
    ? icon('chevron-down')
    : element('span', { class: 'tree__spacer', 'aria-hidden': 'true' })
  return element('span', { class: 'tree__name' }, marker, element('span', { class: 'mono' }, node.name))
}

function figure (value: string): HTMLElement {
  return element('span', { class: 'tree__numbers mono' }, value)
}
