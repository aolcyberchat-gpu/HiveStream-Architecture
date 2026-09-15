# WS-072 — setChannelRank Socket Event (Findings)

Source: recovered from the misfiled `2026-09-07T1055_WS-069-CYTUBE-
LEADER-ASSIGNMENT-SOURCE-SCAN-TEST.js` — an 822KB / 31,211-line raw
JSON output that had been saved under a `-TEST.js` filename instead of
`-TEST-OUTPUT.txt`, per the project's `TEST-ARTIFACT-CREATION-STANDARD.md`.
This finding was buried inside that dump and pulled out separately here.

## Confirmed

`ui.js` line ~600, inside the Channel Settings "Moderators" panel:

```js
/* channel ranks stuff */
function chanrankSubmit(rank) {
    var name = $("#cs-chanranks-name").val();
    socket.emit("setChannelRank", {
        name: name,
        rank: rank
    });
}
```

This is the outbound event used when a moderator/admin sets a user's
**persistent channel rank** (as opposed to `assignLeader`, which is a
temporary, non-persistent playlist-leader grant — see `WS-071`).

## Relationship to other rank/leader events (see WS-071 for full table)

- `setChannelRank` (outbound) — persistent rank change via the Moderators
  panel UI (`+Mod` / `+Admin` / `+Owner` buttons observed in `WS-071`'s
  DOM scan feed into this, each pre-filling a rank value before submit).
- `setUserRank` (inbound) — the server's confirmation/push of a rank
  change back down to clients, updates `user.data("rank")` and
  `CLIENT.rank` if it's the local user.
- `borrow-rank` (outbound) — superadmin-only temporary rank borrowing,
  unrelated to persistent channel rank.

## Still open
- Whether `chanrankSubmit`'s `rank` argument is constrained client-side
  to the same standard scale confirmed in `WS-071`
  (Guest=0/Registered=1/Moderator=2/Channel Admin=3), or whether the
  three UI buttons (`+Mod`, `+Admin`, `+Owner`) map to different literal
  values — the `+Owner` button in particular is unaccounted for in the
  confirmed `standard` scale, which tops out at "Channel Admin" (3)
  before jumping to "Nobody" (1000000). Worth a follow-up scan of the
  `addRank`/button click handlers themselves to find the literal value
  passed for "Owner".
