import { execSync, spawn } from 'child_process'
import readline from 'readline'
import path from 'path'

// Prompt user to select a device
async function promptUserToSelectDevice (devices: string[]): Promise<string> {
  return new Promise((resolve) => {
    console.log('\nMultiple ADB devices found:\n')
    devices.forEach((id, index) => {
      console.log(`  [${index + 1}] ${id}`)
    })

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    rl.question('\nSelect a device number: ', (answer) => {
      rl.close()
      const index = parseInt(answer, 10) - 1
      if (index >= 0 && index < devices.length) {
        resolve(devices[index])
      } else {
        console.error('❌ Invalid selection.')
        process.exit(1)
      }
    })
  })
}

function getAdbDevices (): string[] {
  const output = execSync('adb devices', { encoding: 'utf8' })
  const lines = output.trim().split('\n').slice(1) // skip header

  return lines.map(line => line.trim()).filter(line =>
    line.length > 0 &&
    !line.includes('unauthorized') &&
    !line.includes('offline'),
  ).map(line => line.split('\t')[0])
}

function runWebExt (deviceId: string) {
  const distPath = path.resolve(__dirname, '..', 'dist')
  console.log(`📱 Using Android device: ${deviceId}`)
  console.log(`📂 Using source dir: ${distPath}`)

  const proc = spawn('web-ext', [
    'run',
    '--target=firefox-android',
    `--android-device=${deviceId}`,
    `--source-dir=${distPath}`,
  ], {
    stdio: 'inherit',
    shell: true,
  })

  proc.on('exit', code => process.exit(code ?? 1))
}

async function main () {
  const devices = getAdbDevices()

  if (devices.length === 0) {
    console.error('❌ No ADB devices found.')
    process.exit(1)
  }

  const selectedDevice = devices.length === 1
    ? devices[0]
    : await promptUserToSelectDevice(devices)

  runWebExt(selectedDevice)
}

main()
