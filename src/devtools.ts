import browser from 'webextension-polyfill'

// Create a simple panel in Chrome so devtools scripts stay active
try {
  // chrome.devtools.panels.create is required for Chrome to run the devtools page
  const anyBrowser: any = browser
  anyBrowser?.devtools?.panels?.create?.('GeoBypass', '', 'devtools_panel.html')
} catch {
  // ignore if panel creation fails
}

interface Header {
  name: string;
  value: string;
}

interface DevtoolsRequest {
  url: string;
  method: string;
  headers: Header[];
  postData?: {
    text: string;
  };
}

interface DevtoolsResponse {
  status: number;
  headers: Header[];
}

interface StrictDevtoolsEntry {
  request: DevtoolsRequest;
  response: DevtoolsResponse;

  getContent (): Promise<[string, string]>;
}

function isStrictDevtoolsEntry (obj: unknown): obj is StrictDevtoolsEntry {
  if (typeof obj !== 'object' || obj === null) return false

  // Narrow to an object with unknown properties
  if (!('getContent' in obj)) return false
  const getContent = obj.getContent
  if (typeof getContent !== 'function') return false

  if (!('request' in obj) || !('response' in obj)) return false

  const request = obj.request
  if (
    typeof request !== 'object' || request === null ||
    !('url' in request) || typeof request.url !== 'string' ||
    !('method' in request) || typeof request.method !== 'string' ||
    !('headers' in request) || !Array.isArray(request.headers)
  ) return false

  const response = obj.response
  return !(typeof response !== 'object' || response === null ||
    !('status' in response) || typeof response.status !== 'number' ||
    !('headers' in response) || !Array.isArray(response.headers))
}

function getByteSize (text: string): number {
  return new TextEncoder().encode(text).length
}

function getHeader (headers: Header[], name: string): string | undefined {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value
}

browser.devtools.network.onRequestFinished.addListener(async (entry) => {
  if (!isStrictDevtoolsEntry(entry)) return

  const tabId = browser.devtools.inspectedWindow.tabId
  const url = entry.request.url

  let sentSize = 0

  // Estimate request size from Content-Length if available
  const contentLength = getHeader(entry.request.headers, 'content-length')
  if (contentLength) {
    const parsedLength = parseInt(contentLength, 10)
    if (!isNaN(parsedLength)) {
      sentSize = parsedLength
    }
  }

  // Get response body size
  const [bodyContent] = await entry.getContent()
  const receivedSize = bodyContent ? getByteSize(bodyContent) : 0

  if (sentSize === 0 && receivedSize === 0) return

  browser.runtime.sendMessage({
    type: 'devtoolsNetworkData',
    tabId,
    url,
    sentSize,
    receivedSize,
  }).catch(() => {})
})
