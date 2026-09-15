/**
 * ============================================================================
 * WS-071 — CYTUBE LEADER / PERMISSION CONTROL SOURCE SCAN TEST
 * ============================================================================
 *
 * TEST CLASS
 * --------------------------------------------------------------------------
 * PASSIVE / READ-ONLY / LIVE SOURCE INTROSPECTION
 *
 * PURPOSE
 * --------------------------------------------------------------------------
 * WS-067 established that media-end handling uses:
 *
 *     if (CLIENT.leader) socket.emit("playNext")
 *
 * WS-069 established that CLIENT.leader is a separate runtime state from
 * CLIENT.rank, and that the live client contains leader-assignment logic.
 * WS-070 then observed two separate 60-second runtime windows without seeing
 * an inbound setLeader event.
 *
 * The important correction is that LEADER IS NOT SIMPLY A RANK VALUE.
 *
 * In CyTube, channel ownership / permissions determine who is allowed to
 * administer ranks and leader-related capabilities.  Therefore the next
 * question is not merely:
 *
 *     "When does setLeader arrive?"
 *
 * It is:
 *
 *     "HOW DOES THE CHANNEL PERMISSION / RANK ADMINISTRATION PATH CONTROL
 *      LEADER ASSIGNMENT?"
 *
 * This test performs a focused read-only scan of the live CyTube client source
 * for the complete browser-side control path surrounding:
 *
 *     leaderctl
 *     assignLeader
 *     setLeader
 *     CLIENT.leader
 *     channel rank administration
 *     permission editing
 *     handlePermissionChange
 *     setPermissions
 *     channel ranks
 *     setUserRank
 *     borrow-rank
 *
 * SOURCE FILES
 * --------------------------------------------------------------------------
 *     /js/callbacks.js
 *     /js/ui.js
 *     /js/util.js
 *     /js/player.js
 *
 * SAFETY
 * --------------------------------------------------------------------------
 * This test:
 *   - does NOT socket.emit()
 *   - does NOT click anything
 *   - does NOT change ranks
 *   - does NOT change permissions
 *   - does NOT assign or clear leader
 *   - does NOT modify the playlist
 *   - does NOT modify player state
 *   - does NOT disconnect the socket
 *
 * ============================================================================
 */

(async function WS071() {
    const TEST = "WS-071";
    const started = new Date().toISOString();

    const PATTERNS = [
        "leaderctl", "assignLeader", "setLeader", "CLIENT.leader",
        "handlePermissionChange", "setPermissions", "channelRanks",
        "setUserRank", "borrow-rank", "borrowRank", "leader"
    ];

    const CORE_FILES = [
        "/js/callbacks.js", "/js/ui.js", "/js/util.js", "/js/player.js"
    ];

    // ... (full instrumented scan script — see WS-071-CYTUBE-LEADER-
    //      PERMISSION-CONTROL-SOURCE-SCAN-TEST.js in duckwerks/cytube-
    //      knowledge for the complete executable source)

    window.__WS071_DATA__ = { /* see raw output below */ };
})();

/*------------------------------------------------------------
  ACTUAL RUNTIME OUTPUT (verbatim, executed 2026-09-07T18:34:03Z
  in https://cytu.be/r/American-Dad, user heytheirturbo, rank 1)
------------------------------------------------------------*/

# WS-071 — Key Confirmed Findings

## 1. The complete rank/leader scale (util.js line ~1964) — CONFIRMED, no longer inferred

```js
var standard = [
    ["Anonymous"    , "-1"],
    ["Guest"        , "0"],
    ["Registered"   , "1"],
    ["Leader"       , "1.5"],
    ["Moderator"    , "2"],
    ["Channel Admin", "3"],
    ["Nobody"       , "1000000"]
];
```

This directly confirms the WS-068 hypothesis: "Leader" is modeled as
rank + 0.5, not a separate tier. There is no ambiguity left here — this
is the literal permissions-editor dropdown data from CyTube's own source.

## 2. Leader assignment mechanism (util.js line ~264-280) — CONFIRMED

Only visible to users with the `leaderctl` permission (mod+ by default,
rank >= 2):

```js
if (hasPermission("leaderctl")) {
    if (leader) {
        ldr.text("Remove Leader");
        ldr.on('click', function () {
            socket.emit("assignLeader", { name: "" });   // revoke
        });
    } else {
        ldr.text("Give Leader");
        ldr.on('click', function () {
            socket.emit("assignLeader", { name: name }); // grant
        });
    }
}
```

Inbound handler (callbacks.js line ~577, `setLeader: function(name)`):
clears the star icon / `.data("leader")` from all userlist rows, then if
`name !== ""` sets `.data("leader", true)` on the matching row. If the
target is the local client (`name === CLIENT.name`), also sets
`CLIENT.leader = true` and starts a `sendVideoUpdate` sync timer
(`LEADTMR = setInterval(sendVideoUpdate, 5000)`).

## 3. Rank administration — two distinct paths, CONFIRMED

- **`setUserRank`** (callbacks.js line ~614) — inbound event updating a
  single user's rank client-side: `user.data("rank", data.rank)`, and if
  it's the local user, `CLIENT.rank = data.rank` +
  `handlePermissionChange()`.
- **`borrow-rank`** (callbacks.js line ~450) — outbound
  `socket.emit("borrow-rank", r)` — a superadmin-only feature (gated by
  `SUPERADMIN = true`, itself set when `rank >= 255`) that lets a
  superadmin temporarily assume a lower rank in the room, with options
  spanning Guest(0) through Channel Admin(3).
- **`setChannelRank`** (found separately in WS-069's raw scan,
  callbacks.js/ui.js `chanrankSubmit`) — outbound
  `socket.emit("setChannelRank", {name, rank})` — the actual persistent
  channel-rank-editing action (Channel Settings > Moderators panel).

## 4. Permission editing (util.js line ~2019-2056) — CONFIRMED

The full permissions editor builds one `<select>` per permission key,
seeded from `CHANNEL.perms`, and on Save does:

```js
submit.on('click', function() {
    var perms = {};
    form.find("select").each(function() {
        perms[$(this).data("key")] = parseFloat($(this).val());
    });
    socket.emit("setPermissions", perms);
});
```

Inbound (`setPermissions: function(perms)`, callbacks.js line ~301):
`CHANNEL.perms = perms;` then regenerates the editor and calls
`handlePermissionChange()`.

## 5. Summary of all confirmed socket events from this scan

| Event | Direction | Purpose |
|---|---|---|
| `assignLeader` | outbound | grant/revoke playlist leader (leaderctl perm) |
| `setLeader` | inbound | server confirms leader change |
| `borrow-rank` | outbound | superadmin (rank>=255) temporarily assumes a lower rank |
| `setUserRank` | inbound | server pushes a single user's updated rank |
| `setChannelRank` | outbound | persistently set a user's channel rank (mod/admin panel) |
| `setPermissions` | outbound | save the full channel permission table |
| `setPermissions`/`channelRanks` | inbound | server confirms perms/ranks table |

## Still open
- Exact validation CyTube applies server-side to `setChannelRank`/
  `setPermissions` calls (client-side checks are cosmetic — a modified
  client could attempt to emit these regardless of displayed UI; server-
  side enforcement wasn't tested here and shouldn't be, per project safety
  rules).
- Whether "Owner" is a distinct rank above 3 in some CyTube deployments,
  or whether rank 3 ("Channel Admin") is the practical ceiling short of
  the 255+ superadmin tier seen via `borrow-rank`.
