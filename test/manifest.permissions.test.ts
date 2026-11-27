import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  CHROME_PERMISSION_CALLERS,
  FIREFOX_PERMISSION_CALLERS,
  permissionsWithoutCaller,
  readRepositoryFile,
  REPOSITORY_ROOT,
} from './permissionCallers'

function manifestPermissions (manifestPath: string): string[] {
  const manifest = JSON.parse(readFileSync(resolve(REPOSITORY_ROOT, manifestPath), 'utf8')) as { permissions: string[] }
  return manifest.permissions
}

describe('manifest permissions', () => {
  it('has a caller in the Firefox build for every Firefox permission', () => {
    const unused = permissionsWithoutCaller(
      manifestPermissions('assets/manifests/firefox/manifest.json'),
      FIREFOX_PERMISSION_CALLERS,
      readRepositoryFile,
    )
    expect(unused).toEqual([])
  })

  it('has a caller in the Chrome build for every Chrome permission', () => {
    const unused = permissionsWithoutCaller(
      manifestPermissions('assets/manifests/chrome/manifest.json'),
      CHROME_PERMISSION_CALLERS,
      readRepositoryFile,
    )
    expect(unused).toEqual([])
  })
})
