import AdmZip from 'adm-zip'
import esbuild from 'esbuild'
import fs from 'fs-extra'
import path from 'path'
import { execSync } from 'child_process'

const DIST_DIR = path.resolve('dist')
const FIREFOX_MANIFEST = path.resolve('assets/manifests/firefox/manifest.json')
const CHROME_MANIFEST = path.resolve('assets/manifests/chrome/manifest.json')

const BROWSER_MANIFESTS: Record<string, string> = {
  firefox: FIREFOX_MANIFEST,
  chrome: CHROME_MANIFEST,
}

const PUBLIC: string[] = ['assets/dashboard.html', 'assets/popup.html', 'assets/dashboard.css']

// Parse command-line arguments
const args = process.argv.slice(2)
const minify = args.includes('--minify')

async function cleanDist () {
  console.log('Cleaning dist directory...')
  await fs.remove(DIST_DIR)
  console.log('Dist directory cleaned.')
}

async function copyFiles (browser: string) {
  const manifestPath = BROWSER_MANIFESTS[browser]
  if (!manifestPath) {
    throw new Error(`Unsupported browser: ${browser}`)
  }

  console.log(`Copying files for ${browser}...`)
  await fs.copy(manifestPath, path.join(DIST_DIR, 'manifest.json'))
  for (const asset of PUBLIC) {
    const destination = path.join(DIST_DIR, path.basename(asset))
    await fs.copy(asset, destination)
  }
  console.log(`Files copied for ${browser}.`)
}

async function typeCheck () {
  console.log('Running TypeScript type check...')
  try {
    execSync('tsc --noEmit', { stdio: 'inherit' }) // Ensure strict checks with no file emission
    console.log('TypeScript type check passed.')
  } catch (err) {
    console.error('TypeScript type check failed.', err)
    process.exit(1) // Exit with an error code to stop the build
  }
}

async function bundleScripts () {
  await typeCheck()
  console.log('Bundling scripts with esbuild...')
  await esbuild.build({
    entryPoints: [
      'src/*.ts',
    ],
    outdir: DIST_DIR,
    bundle: true,
    allowOverwrite: true,
    format: 'iife',
    target: 'esnext',
    platform: 'browser',
    minify: minify,
  })
  console.log('Scripts bundled.')
}

async function packageForFirefox () {
  console.log('Packaging for Firefox...')
  execSync(`web-ext build --overwrite-dest --source-dir=${DIST_DIR} --artifacts-dir=build`, {
    stdio: 'inherit',
  })
  console.log('Firefox package created.')
}

async function packageForChrome () {
  console.log('Packaging for Chrome...')
  try {
    const manifestPath = path.join(DIST_DIR, 'manifest.json')
    const manifest = await fs.readJson(manifestPath)

    const zip = new AdmZip()
    zip.addLocalFolder(DIST_DIR)

    const outputDir = path.resolve('build')
    await fs.ensureDir(outputDir)

    const sanitizedName = manifest.name.toLowerCase().replace(/\s+/g, '_')
    const outputFile = path.join(outputDir, `${sanitizedName}_${manifest.version}_chrome.zip`)

    zip.writeZip(outputFile)

    console.log(`Chrome package created at ${outputFile}`)
  } catch (error) {
    console.error('Error while creating Chrome package:', error)
    throw error
  }
}

async function buildAll (targetBrowser: string) {
  await cleanDist()
  await bundleScripts()
  if (!Object.keys(BROWSER_MANIFESTS).includes(targetBrowser)) {
    throw new Error(`Unsupported browser: ${targetBrowser}`)
  }
  await copyFiles(targetBrowser)
}

async function main () {
  const task = args[0]
  const targetBrowser = args[1]

  const supportedBrowsers = Object.keys(BROWSER_MANIFESTS)

  try {
    switch (task) {
      case 'clean':
        await cleanDist()
        break

      case 'bundle':
        await bundleScripts()
        break

      case 'copy':
        if (!targetBrowser) {
          console.error('No target browser specified for \'copy\' task.')
          process.exit(1)
        }
        if (supportedBrowsers.includes(targetBrowser)) {
          await copyFiles(targetBrowser)
        } else {
          console.error(`Unsupported browser for 'copy': ${targetBrowser}`)
          process.exit(1)
        }
        break

      case 'build':
        if (!targetBrowser) {
          console.error('No target browser specified for \'build\' task.')
          process.exit(1)
        }
        if (supportedBrowsers.includes(targetBrowser)) {
          await buildAll(targetBrowser)
        } else {
          console.error(`Unsupported browser for 'build': ${targetBrowser}`)
          process.exit(1)
        }
        break

      case 'package':
        if (!targetBrowser) {
          console.error('No target browser specified for \'package\' task.')
          process.exit(1)
        }
        if (!supportedBrowsers.includes(targetBrowser)) {
          console.error(`Unsupported browser for 'package': ${targetBrowser}`)
          process.exit(1)
        }
        await buildAll(targetBrowser)
        if (targetBrowser === 'firefox') {
          await packageForFirefox()
        } else if (targetBrowser === 'chrome') {
          await packageForChrome()
        }
        break

      default:
        console.error('Unknown task. Use \'clean\', \'bundle\', \'copy\', \'build\', or \'package\'.')
        process.exit(1)
    }
  } catch (error) {
    console.error(`Task '${task}' failed:`, error)
    process.exit(1)
  }
}

main().then(() => console.log('All tasks done.'))
