import { element } from '@ui/dom'
import { failures } from './check-log'
import { checkFieldError, checkButtonRunsHandler, checkDisclosureOpens, checkSegmentedArrow, checkSegmentedSelects, checkStateBodyRetryFromError, checkStateBodyShowsEachState, checkSwitchSpace, checkSwitchToggles, checkTypeGridToggle } from './control-checks'
import { checkPatternListAddRemove, checkPatternRowFaults, checkTreeOpenAndClosed } from './list-checks'
import { checkSheetFlow } from './sheet-checks'
import { checkFocusRingAndTokens } from './focus-checks'
import { currentScheme } from './scheme'
import { stage } from './stage'

const OUTCOME_ID = 'component-test-outcome'

async function runChecks (): Promise<void> {
  checkButtonRunsHandler()
  checkSwitchToggles()
  checkSegmentedSelects()
  checkDisclosureOpens()
  checkStateBodyShowsEachState()
  checkStateBodyRetryFromError()
  checkFieldError()
  checkPatternRowFaults()
  await checkSwitchSpace()
  await checkSegmentedArrow()
  await checkTypeGridToggle()
  await checkPatternListAddRemove()
  await checkTreeOpenAndClosed()
  await checkSheetFlow()
  await checkFocusRingAndTokens()
}

function writeOutcome (): void {
  document.body.append(element('output', {
    id: OUTCOME_ID,
    'data-scheme': currentScheme(),
    'data-failures': JSON.stringify(failures),
  }))
}

document.body.append(stage)
runChecks()
  .catch(err => failures.push(`check aborted: ${err instanceof Error ? err.message : String(err)}`))
  .then(writeOutcome)
