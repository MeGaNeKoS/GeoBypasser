---
status: done
owner: extension
depends_on: [E04/S07/T02]
---

# T03 Last review fixes for Network and Import and export

From the designer's second look and the reviewer's walk. Done when every item holds, each checked in a real browser.

## Reviewer

1. Pressing Import applies the user's choices to the config as stored at that moment, not as it was when the Review opened. An entry added or changed in another tab while the Review is open is kept. If the stored config changed in a way that affects the Review (a new duplicate, a changed setting), the Review is shown again with the current state instead of saving. Checked in both browsers with a rule added from a second tab while the Review is open.
2. Every control in Import and export keeps focus across a storage write from another tab, and text typed in the URL field is kept. Checked in both browsers.

## Designer

3. The URL field shows the designed field error ("Enter an http or https address.") instead of the browser's own validation bubble.
4. The URL field fills the row beside the Import button.
5. At narrow width, Network's Sent and Received sit under the host name, indented to the name's column.

The reviewer confirmed the bad file error in the sheet, the Browse flow, and the Network empty state, which closes the designer's unseen items 7, 13, and 14.
