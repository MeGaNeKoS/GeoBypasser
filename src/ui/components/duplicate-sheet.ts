import { element } from '../dom'
import { segmented } from './controls'
import type { SegmentOption } from './controls'
import { draftOf, draftValue, openSheet } from './sheet'

export type ReplaceChoice = 'replace' | 'skip'

export type DuplicatePrompt<Choice extends string> = {
  title: string;
  message: string;
  options: SegmentOption<Choice>[];
  skip: Choice;
}

const REPLACE_OPTIONS: SegmentOption<ReplaceChoice>[] = [
  { value: 'replace', label: 'Replace the saved one' },
  { value: 'skip', label: 'Skip this one' },
]

export async function askReplacements (duplicateKeys: string[], messageFor: (key: string) => string): Promise<string[]> {
  const replaced: string[] = []
  for (const key of duplicateKeys) {
    const choice = await askDuplicateChoice<ReplaceChoice>({
      title: 'Already saved',
      message: messageFor(key),
      options: REPLACE_OPTIONS,
      skip: 'skip',
    })
    if (choice === 'replace') replaced.push(key)
  }
  return replaced
}

export function askDuplicateChoice<Choice extends string> (prompt: DuplicatePrompt<Choice>): Promise<Choice> {
  return new Promise(resolve => {
    openSheet({
      title: prompt.title,
      saveLabel: 'Apply',
      draft: draftOf({ choice: prompt.skip }),
      render: draft => [
        element('p', {}, prompt.message),
        segmented('What to do', 'choice', prompt.options, draftValue(draft, 'choice') as Choice),
      ],
      validate: () => [],
      save: draft => resolve(draftValue(draft, 'choice') as Choice),
      closed: () => resolve(prompt.skip),
    })
  })
}
