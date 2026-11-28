import { element } from '../dom'

export const SECTION_HEADING_FOCUS_KEY = 'section-heading'

export function sectionHeading (text: string): HTMLHeadingElement {
  return element('h2', { class: 'page-title', tabindex: '-1', 'data-focus-key': SECTION_HEADING_FOCUS_KEY }, text)
}
