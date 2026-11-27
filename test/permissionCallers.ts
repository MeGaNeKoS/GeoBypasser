import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export interface PermissionCaller {
  file: string;
  pattern: RegExp;
}

export type PermissionCallers = Record<string, PermissionCaller[]>

export type SourceReader = (repositoryPath: string) => string

export const REPOSITORY_ROOT = resolve(__dirname, '..')

export const readRepositoryFile: SourceReader = repositoryPath => readFileSync(resolve(REPOSITORY_ROOT, repositoryPath), 'utf8')

export function permissionsWithoutCaller (
  permissions: string[],
  callers: PermissionCallers,
  readSource: SourceReader,
): string[] {
  return permissions.filter(permission => !hasCaller(callers[permission] ?? [], readSource))
}

function hasCaller (candidates: PermissionCaller[], readSource: SourceReader): boolean {
  return candidates.some(({ file, pattern }) => pattern.test(readSource(file)))
}

export const FIREFOX_PERMISSION_CALLERS: PermissionCallers = {
  proxy: [{ file: 'src/background.firefox.ts', pattern: /browser\.proxy\./ }],
  storage: [{ file: 'src/utils/storage.ts', pattern: /browser\.storage\./ }],
  tabs: [
    { file: 'src/background.firefox.ts', pattern: /browser\.tabs\./ },
    { file: 'src/popup.ts', pattern: /browser\.tabs\./ },
  ],
  notifications: [
    { file: 'src/background.firefox.ts', pattern: /browser\.notifications\./ },
    { file: 'src/core/keepAlive.ts', pattern: /browser\.notifications\./ },
  ],
  webRequest: [{ file: 'src/background.firefox.ts', pattern: /browser\.webRequest\./ }],
  webRequestBlocking: [{ file: 'src/background.firefox.ts', pattern: /'blocking'/ }],
  '<all_urls>': [{ file: 'src/background.firefox.ts', pattern: /'<all_urls>'/ }],
}

export const CHROME_PERMISSION_CALLERS: PermissionCallers = {
  proxy: [{ file: 'src/utils/pac.ts', pattern: /browser\.proxy\./ }],
  storage: [{ file: 'src/utils/storage.ts', pattern: /browser\.storage\./ }],
  tabs: [{ file: 'src/popup.ts', pattern: /browser\.tabs\./ }],
  webRequest: [{ file: 'src/background.chrome.ts', pattern: /chrome\.webRequest\.onAuthRequired\.addListener/ }],
  webRequestAuthProvider: [{ file: 'src/background.chrome.ts', pattern: /chrome\.webRequest\.onAuthRequired\.addListener/ }],
}
