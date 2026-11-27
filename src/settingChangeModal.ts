import type { ImportableSetting, SettingChange } from '@utils/importFiles'

type SettingChoice = 'keep' | 'apply'

export async function chooseAppliedSettingChanges (changes: SettingChange[]): Promise<ImportableSetting[]> {
  const applied: ImportableSetting[] = []
  for (const change of changes) {
    if (await chooseSettingChange(change) === 'apply') applied.push(change.setting)
  }
  return applied
}

function chooseSettingChange (change: SettingChange): Promise<SettingChoice> {
  const modal = document.getElementById('settingChangeModal')!
  const keepButton = document.getElementById('settingChangeKeep')!
  const applyButton = document.getElementById('settingChangeApply')!

  document.getElementById('settingChangeTitle')!.textContent = change.title
  document.getElementById('settingChangeOld')!.textContent = change.oldText
  document.getElementById('settingChangeNew')!.textContent = change.newText
  modal.classList.remove('hidden')
  keepButton.focus()

  return new Promise(resolve => {
    function finish (choice: SettingChoice) {
      keepButton.removeEventListener('click', onKeep)
      applyButton.removeEventListener('click', onApply)
      modal.removeEventListener('keydown', onKeyDown)
      modal.classList.add('hidden')
      resolve(choice)
    }

    function onKeep () { finish('keep') }

    function onApply () { finish('apply') }

    function onKeyDown (ev: KeyboardEvent) {
      if (ev.key === 'Escape') finish('keep')
    }

    keepButton.addEventListener('click', onKeep)
    applyButton.addEventListener('click', onApply)
    modal.addEventListener('keydown', onKeyDown)
  })
}
