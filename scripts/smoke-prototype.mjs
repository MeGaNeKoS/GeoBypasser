import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PROTOTYPE_DIR = join(ROOT, 'prototype')
const STYLESHEET_LINK = /<link rel="stylesheet" href="([^"]+)">/g
const TRANSPARENT = 'rgba(0, 0, 0, 0)'

export const PROTOTYPE_PAGES = ['index.html', 'popup.html']

export function prototypeUrl (page) {
  return pathToFileURL(join(PROTOTYPE_DIR, page)).href
}

export function missingStylesheets (page) {
  const html = readFileSync(join(PROTOTYPE_DIR, page), 'utf8')
  return [...html.matchAll(STYLESHEET_LINK)]
    .map(([, href]) => href)
    .filter(href => !existsSync(join(PROTOTYPE_DIR, href)))
}

export function readPrototypeState () {
  return {
    rendered: document.getElementById('app')?.children.length ?? 0,
    background: getComputedStyle(document.body).backgroundColor,
  }
}

export function prototypeProblems (page, state, missing) {
  const problems = missing.map(href => `prototype ${page} links a stylesheet that does not exist: ${href}`)
  if (state.rendered === 0) problems.push(`prototype ${page} rendered no content`)
  if (state.background === TRANSPARENT) problems.push(`prototype ${page} has a transparent page background, so the token styles did not apply`)
  return problems
}
