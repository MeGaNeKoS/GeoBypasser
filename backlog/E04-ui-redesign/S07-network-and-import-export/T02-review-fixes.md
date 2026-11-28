---
status: done
owner: extension
depends_on: [E04/S07/T01]
---

# T02 Review fixes for Network and Import and export

From the designer's review of `E04/S07`. Done when every item holds, each checked in a real browser, and screenshots of the Review step in each state, the Export sheet, "Choose files", and Network at narrow width are captured in both browsers and looked at. The duplicate choice labels follow `design.md`: "Keep existing | Use new | Keep both"; this replaces the wording in criterion 3.

## Review step

1. The Review step has the designed groups: "To add" with the counts as body text; one "Needs your attention (N)" group with every refusal and ignored setting word for word, a warning icon on each "was not imported" line and an info icon on each "is ignored" line.
2. Duplicates sit in "Already in your list (N)": the entry in mono, and a segmented control "Keep existing | Use new | Keep both" ("Keep both" only where the list allows it), with "Keep existing" preselected.
3. Changed settings sit in "Settings in this file (N)": each row has the setting name, "Current:" and "Imported:" values (URLs in mono), and a "Keep current | Use imported" segmented control defaulting to "Keep current".
4. When nothing can be added and no duplicate or setting is offered, "To add" reads "Nothing in this file can be imported" and Import is disabled. When a duplicate or setting is offered and nothing new is added, the "To add" group is left out.
5. A bad file or a failed fetch shows its error in the sheet body with "Choose another" and "Cancel".
6. Import notes from an earlier import are cleared when a new import starts.

## Import card and Choose files

7. "From a URL" is an inline address field with an "Import" button and the help below it, no extra sheet.
8. "Choose files" shows the repository name under the title, "Select all", "Unselect all", and "N selected"; files are grouped under their folder, each folder with a checkbox that selects its files; paths in mono. The primary button reads "Continue".
9. The Community row's button reads "Browse". Home's "Browse community rules" (quick action and Get started step) opens the section and starts the Community step at once, returning focus to the section's Browse button on close.

## Export sheet

10. No native fieldset border; each group is a label style heading with a quiet "Select all" at its right end, checkboxes listed below; "Select entire config" at natural width; the group is named "Sites", not "Overrides".

## Network

11. Below 720 px, Sent and Received drop under the name, and host names never break letter by letter.
12. At 720 px and wider, Sent and Received are two fixed, right aligned columns.
13. The Chrome note is an info banner: "Keep DevTools open while monitoring."
14. The empty state text is regular weight, and the tree has no inner border.

## Copy

15. Section help reads "Back up or restore …".
