import { element } from '../dom'
import { segmented } from './controls'
import type { SegmentOption } from './controls'
import { draftOf, draftValue, openSheet } from './sheet'

export type ReplaceChoice = 'replace' | 'skip'

const REPLACE_OPTIONS: SegmentOption<ReplaceChoice>[] = [
  { value: 'replace', label: 'Replace the saved one' },
  { value: 'skip', label: 'Skip this one' },
]

export async function askReplacements (duplicateKeys: string[], messageFor: (key: string) => string): Promise<string[]> {
  const replaced: string[] = []
  for (const key of duplicateKeys) {
    if (await askReplaceOrSkip(messageFor(key)) === 'replace') replaced.push(key)
  }
  return replaced
}

function askReplaceOrSkip (message: string): Promise<ReplaceChoice> {
  return new Promise(resolve => {
    openSheet({
      title: 'Already saved',
      saveLabel: 'Apply',
      draft: draftOf({ choice: 'skip' }),
      render: draft => [
        element('p', {}, message),
        segmented('What to do', 'choice', REPLACE_OPTIONS, draftValue(draft, 'choice') as ReplaceChoice),
      ],
      validate: () => [],
      save: draft => resolve(draftValue(draft, 'choice') as ReplaceChoice),
      closed: () => resolve('skip'),
    })
  })
}
