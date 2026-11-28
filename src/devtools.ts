import browser from 'webextension-polyfill'

// Create a simple panel in Chrome so devtools scripts stay active
try {
  // chrome.devtools.panels.create is required for Chrome to run the devtools page
  const anyBrowser: any = browser
  anyBrowser?.devtools?.panels?.create?.('GeoBypass', '', 'devtools_panel.html')
} catch {
  // ignore if panel creation fails
}
