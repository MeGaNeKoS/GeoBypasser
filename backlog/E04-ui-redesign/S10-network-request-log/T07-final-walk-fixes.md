---
status: done
owner: extension
depends_on: [E04/S10/T06]
---

# T07 Fixes from the final walk

From the reviewer's final walk of `E04/S10` at `fe17111`. Done when every item holds, each checked in a real browser.

1. New traffic from a monitored tab shows in the Network section without Refresh: the background tells open dashboards when usage changes (at most about once a second), and the section re-reads on it, keeping focus. This is `T06` item 2, not met today (the reviewer waited 12 s on a reloaded page).
2. On Firefox, a rule with "Only when the page is on" set to a host routes that page's own top level navigation (`main_frame`), whose page is the request's own URL, and its favicon. Today the walk showed the page's own requests going Direct under such a rule. If the routing already does this and only the log mislabels it, say so with the evidence.
4. Results takes spare width from Action so an error code breaks only when it does not fit, and the result icon aligns with the first line.
5. "Skip in rule 'name'" is not offered for a host already in that rule's "Never proxy these hosts".
3. The route reason separates a host the user skipped ("Direct, skipped by rule 'name'", from "Never proxy these hosts") from a request outside a rule's fine tuning ("Direct, outside rule 'name' limits", for a page or type limit), so the log never claims a skip the user did not make.
