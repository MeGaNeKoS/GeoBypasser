import { parseGitHubTreeEntries } from '@schemas/githubTree'
import { checkbox } from '../components/controls'
import { draftOf, openSheet } from '../components/sheet'
import { importConfigFromUrl } from './configImport'
import type { ImportReport } from './configImport'

export type GitHubRepository = {
  owner: string;
  repo: string;
  prefix: string;
}

export const COMMUNITY_RULES: GitHubRepository = { owner: 'MeGaNeKoS', repo: 'GeoBypass-Rules', prefix: '' }

const GITHUB_REPOSITORY_URL = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/[^/]+\/(.*))?\/?$/
const JSON_SUFFIX = '.json'
const NO_FILES_MESSAGE = 'No rules files were found in that folder.'
const READ_FAILED_MESSAGE = 'Could not read one of the chosen rules files.'

type RepositoryFile = {
  label: string;
  url: string;
}

export function parseGitHubRepositoryUrl (value: string): GitHubRepository | null {
  const match = value.match(GITHUB_REPOSITORY_URL)
  if (!match) return null
  const [, owner, repo, prefix = ''] = match
  return { owner, repo, prefix }
}

export async function openRepositoryRules (repository: GitHubRepository, report: (result: ImportReport) => void): Promise<void> {
  const files = await listJsonFiles(repository)
  if (files.length === 0) {
    report({ messages: [NO_FILES_MESSAGE], summary: null })
    return
  }
  const chosenUrls = new Set<string>()
  openSheet({
    title: 'Choose rules',
    saveLabel: 'Import selected',
    draft: draftOf({}),
    render: () => files.map(file => checkbox(file.label, false, checked => setChosen(chosenUrls, file.url, checked))),
    validate: () => [],
    save: () => { void importChosen(files.filter(file => chosenUrls.has(file.url)), report) },
  })
}

async function listJsonFiles (repository: GitHubRepository): Promise<RepositoryFile[]> {
  const { owner, repo } = repository
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const folder = folderPathOf(repository.prefix)
  return parseGitHubTreeEntries(await response.json())
    .filter(entry => entry.type === 'blob' && entry.path.endsWith(JSON_SUFFIX) && entry.path.startsWith(folder))
    .map(entry => ({ label: entry.path.slice(folder.length), url: rawUrlOf(owner, repo, entry.path) }))
}

function folderPathOf (prefix: string): string {
  const trimmed = prefix.replace(/\/+$/, '')
  return trimmed ? `${trimmed}/` : ''
}

function rawUrlOf (owner: string, repo: string, path: string): string {
  return `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${path}`
}

function setChosen (chosenUrls: Set<string>, url: string, checked: boolean): void {
  if (checked) chosenUrls.add(url)
  else chosenUrls.delete(url)
}

async function importChosen (files: RepositoryFile[], report: (result: ImportReport) => void): Promise<void> {
  for (const file of files) {
    report(await importRepositoryFile(file.url))
  }
}

async function importRepositoryFile (url: string): Promise<ImportReport> {
  try {
    return await importConfigFromUrl(url)
  } catch {
    return { messages: [READ_FAILED_MESSAGE], summary: null }
  }
}
