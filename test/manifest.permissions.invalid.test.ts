import { FIREFOX_PERMISSION_CALLERS, permissionsWithoutCaller, readRepositoryFile } from './permissionCallers'

describe('manifest permissions without a caller', () => {
  it('reports a permission that no caller in the build uses', () => {
    const unused = permissionsWithoutCaller(['cookies', 'tabs'], FIREFOX_PERMISSION_CALLERS, readRepositoryFile)
    expect(unused).toEqual(['cookies'])
  })

  it('reports a permission whose caller file no longer makes the call', () => {
    const unused = permissionsWithoutCaller(['tabs'], FIREFOX_PERMISSION_CALLERS, () => '')
    expect(unused).toEqual(['tabs'])
  })
})
