# WS-075 — Channel Core Lifecycle & Playlist Engine: Full Server-Source Findings

**Authors:** Ed (project owner — Termux/Kiwi reverse-engineering, GitHub
knowledge base curator) & Claude (Anthropic — source analysis of
`calzoneman/sync`)

**Purpose of this document:** Reference artifact for
`duckwerks/cytube-knowledge`, written so any LLM (Claude, ChatGPT, or
otherwise) can understand CyTube's two most foundational server files —
the channel join/leave lifecycle and the playlist/sync engine — without
re-deriving them from scratch. This is the natural companion to `WS-074`
(the nine feature modules) and `WS-068`–`WS-073` (rank/permission/leader
system): those describe *what* each feature does, this describes *how a
user gets into a room in the first place* and *how playback stays in
sync across every client*.

**Source:** `calzoneman/sync` (https://github.com/calzoneman/sync),
`src/channel/channel.js` (763 lines) and `src/channel/playlist.js`
(1428 lines) — ground truth, not inferred from client scraping.

---

## PART A — `channel.js`: the core Channel object

### A1. Module load order (matters for anything depending on cross-module state)
`initModules()` constructs all 16 channel modules in this fixed order:
```
permissions → emotes → chat → drink → filters → customization →
options → library → playlist → mediarefresher → voteskip → poll →
kickban → ranks → accesscontrol → anonymouscheck
```
Notable: `permissions` loads first (everything else checks against it),
`drink` loads before `filters` (both hook `onUserPreChat`, so drink's
hijack of `/d` messages runs before the filter pipeline ever sees them),
and `playlist` loads before `voteskip`/`poll`/`kickban` (those modules
reference `this.channel.modules.playlist` directly in their
constructors and would break if playlist weren't ready first).

### A2. The `checkModules` pipeline — how permission-gate hooks actually chain
This is the mechanism behind `onUserPreJoin` (ban checks, WS-074 §4) and
`onUserPreChat` (drink hijacking, WS-074 §9): `checkModules(fn, args,
cb)` walks every module **in registration order**, calling `module[fn]`
on each and only proceeding to the next module if the previous one
called back with `ChannelModule.PASSTHROUGH`. Any module returning
`ChannelModule.DENY` (or an error) **stops the chain immediately** and
invokes the final callback with that result — later modules never see
the event at all. Any future custom server-side module hooking
`onUserPreChat`/`onUserPreJoin` needs to know its position in the module
list determines whether it runs before or after existing gates like
ban-checking or the drink counter.

### A3. Full user join sequence (`joinUser` → `acceptUser`)
1. Wait for `Flags.C_READY` (channel fully loaded).
2. Reject immediately if the socket already disconnected mid-load.
3. On `Flags.U_LOGGED_IN`: if registered, fetch the user's **persisted
   channel rank** from the DB (`db.channels.getRank`) and set it via
   `user.setChannelRank(rank)` — this is where a channel-specific rank
   (as opposed to global rank) actually gets attached to the session.
4. Run `checkModules("onUserPreJoin", ...)` — this is where `kickban.js`
   rejects banned users (§A2 above), before anything else happens.
5. `acceptUser`: sets `U_IN_CHANNEL`, joins the Socket.IO room
   (`user.socket.join(this.name)`), sets AFK auto-timer, checks Tor
   exit-node status against the `torbanned` option (kicks if blocked).
6. On login: **kicks any existing session with the same username**
   ("Duplicate login") — a user can't have two simultaneous sessions
   under one name in the same channel.
7. Pushes the user into `this.users`, wires the `disconnect` →
   `partUser` handler.
8. Calls `onUserPostJoin` on **every** module (this is where each
   module's own socket listeners — `chatMsg`, `vote`, `setOptions`,
   etc. — actually get registered for this specific user's socket).
9. Sends the userlist (`sendUserlist`, see A5), then **separately**
   emits `setLeader` if a leader is currently assigned (playlist
   leadership is announced individually here, not baked into the
   userlist payload itself).
10. Throttled `usercount` broadcast (`USERCOUNT_THROTTLE = 10000ms` —
    joins/parts in a burst don't spam a usercount update per-user).

### A4. Part/disconnect sequence (`partUser`)
Broadcasts `userLeave` (only if the user was actually logged in — an
anonymous/never-logged-in socket disconnecting doesn't announce
anything), removes from `this.users`, calls `onUserPart` on every
module (this is where `voteskip.js` retracts that user's vote and
`poll.js` uncounts their vote if `retainVotes` is off), then throttled
usercount update.

### A5. Three-tier userlist visibility — a significant finding not previously documented
`packUserData` builds **three different payloads per user**, and which
one a given client receives depends on the *viewer's* rank, not the
subject's:

| Viewer tier | Sees on every other user |
|---|---|
| Everyone (base) | name, rank, profile, `meta: {afk, muted}` |
| Moderator (`effectiveRank >= 2`) | + `smuted`, `aliases`, **`ip` (cloaked/masked)** |
| Superadmin (`globalRank >= 255`) | + `ip` (real, **unmasked**) |

**This is a meaningful correction to any prior client-side scraping
assumption**: a regular user's client *never receives* `aliases` or
`ip` data for other users at all — it's not hidden client-side, the
server simply never sends it to non-mods. A custom script reading
`.data("meta")` on a userlist item will only ever see `aliases`/`ip`
if the logged-in user is themselves rank >= 2 (mod) or a superadmin.
Same three-tier split applies to `sendUserJoin` (`addUser` event) and
`sendUserMeta` (`setUserMeta` event) — all three userlist-related
broadcasts respect this visibility split independently per recipient.

### A6. Public channel listing name-prefix sigils — new finding
`packInfo` (used for the site's public channel/user list, not the
in-room userlist) prefixes usernames with a rank-based sigil:
| Rank | Prefix |
|---|---|
| `globalRank >= 255` (superadmin) | `!` |
| `effectiveRank >= 4` (Channel Owner) | `~` |
| `effectiveRank >= 3` (Channel Admin) | `&` |
| `effectiveRank >= 2` (Moderator) | `@` |
| `< 2` | none |

### A7. Rank change re-triggers a userlist resend, but only sometimes
`maybeResendUserlist` only forces a full userlist resend to a user when
their rank crosses the **mod boundary (2)** or the **superadmin
boundary (255)** — i.e. when the *shape* of data they're entitled to
see changes (per A5). Crossing from rank 1 to 1.5 (gaining Leader, for
example) does **not** trigger a resend, since the visibility tier is
unaffected.

### A8. Channel log access
`readChanLog` requires `effectiveRank >= 3` (Channel Admin) — violating
this kicks the user, consistent with the kick-on-violation pattern from
WS-074. Only works on registered channels; reads at most the last
102,400 bytes of the log file.

---

## PART B — `playlist.js`: the queue and playback-sync engine

### B1. Queueing validation pipeline (`handleQueue` → `queueStandard`/`queueYouTubePlaylist` → `_addItem`)
In order, a queue request is checked against:
1. `data.pos` must be exactly `"next"` or `"end"` — anything else is
   silently dropped.
2. Custom titles (`data.title`) are only honored for `type: "cu"`
   (custom embed) or `type: "fi"` (raw file) — otherwise discarded.
3. `canAddVideo` (general add permission), then `canAddNext` specifically
   if `pos === "next"`.
4. **Type-specific permission gates**, each with its own `queueFail`
   reason: `canAddList` (YouTube playlists, type `"yp"`), `canAddLive`
   (livestreams), `canAddCustom` (type `"cu"`), `canAddRawFile` (types
   `"fi"`/`"cm"`).
5. **Queue-rate throttle** — separate from chat's antiflood: burst
   3/sustained 1 per second normally, burst 10/sustained 2 for
   `effectiveRank >= 2`.
6. Then in `_addItem`: max-length check against the `maxlength` channel
   option (bypassed by `canExceedMaxLength`), a **hard playlist size
   cap** (`MAX_ITEMS`, from `Config.get("playlist.max-items")` —
   server-configured, not hardcoded), duplicate-video rejection (unless
   `allow_dupes` option is on), per-user item-count cap
   (`playlist_max_per_user`, bypassable via
   `canExceedMaxItemsPerUser`), per-user **total duration** cap
   (`playlist_max_duration_per_user`, bypassable via
   `canExceedMaxDurationPerUser`), and an outright block on
   age-restricted YouTube videos (`ytRating === "ytAgeRestricted"` —
   no permission bypasses this one).
7. Country-restricted videos aren't blocked, just **warned** via a
   `queueWarn` event listing the restricted countries — the video is
   still added.

### B2. Two failure-reporting channels
`queueFail` (with `{msg, link, id}`) covers validation/permission
failures. `queueWarn` is a **non-blocking** advisory (currently only
used for geo-restricted videos) — a client needs to treat these
differently: `queueFail` means nothing was added, `queueWarn` means
something *was* added but the user should be told about a caveat.

### B3. Playback authority: leader vs. autolead — the core sync mechanism
This is the most structurally important part of the whole module:

**With an assigned leader** (`this.leader != null`): the server does
**not** run its own timer at all. `startPlayback` just sets the media
state and sends `changeMedia` — position updates come entirely from the
leader's client via `mediaUpdate` frames (the leader's client runs its
own `sendVideoUpdate` timer, confirmed in `WS-071`, at a 5-second
interval). The server is a passive relay in this mode.

**Without a leader ("autolead")**: the server itself is the
authoritative clock:
- **3-second lead-in buffer**: a new video starts at `currentTime =
  -3` (paused-equivalent state) rather than `0`, to let clients buffer
  before playback visibly starts. (Live streams / zero-duration media
  skip this and start at `0` immediately.)
- **1-second server tick** (`_leadInterval`, `setInterval(..., 1000)`)
  advances `currentTime` by real elapsed wall-clock delta each tick —
  not a fixed increment, so it self-corrects for any event-loop lag.
- **`mediaUpdate` is NOT broadcast every tick** — only every
  `UPDATE_INTERVAL` ticks, where `UPDATE_INTERVAL =
  Config.get("playlist.update-interval")` (server-configured). Clients
  are expected to interpolate/extrapolate position locally between
  updates, not expect a steady stream of sync frames.
- **2-second grace period past the nominal end** before advancing to
  the next item (`currentTime >= media.seconds + 2`) — allows slightly
  desynced clients to finish.
- Losing/gaining a leader mid-playback correctly starts/stops this
  timer (`startPlayback` explicitly clears any existing
  `_leadInterval` before deciding whether a new one is needed).

**Practical implication for a custom sync-checking or overlay script**:
whether to trust `mediaUpdate` broadcasts as frequent-and-regular vs.
sparse-and-interpolated depends entirely on whether the room currently
has a leader — there is no single fixed sync-frame interval across both
modes.

### B4. Temp vs. non-temp items and end-of-video advancement
`_playNext` picks `this.current.next || this.items.first` (wraps to the
start of the playlist if nothing follows) as the next candidate — but
if the *current* item is marked `temp` (not persisted to the channel
library), it's deleted first, and the delete handler itself is
responsible for triggering the next video, rather than `_playNext`
doing both steps directly.

### B5. Leader assignment cross-reference
Already fully documented in `WS-071`/`WS-073` — the
`effectiveRank = 1.5` grant/revoke mechanism lives in this file
(`handleAssignLeader`, gated by `canAssignLeader`/`leaderctl`).
Noted here only for completeness of the module map.

---

## Cross-cutting notes tying this to WS-074

- The three-tier userlist visibility (A5) directly affects how any
  future WS-0xx *client-side* scan should be interpreted: a scan run
  as a plain rank-1 user will structurally never see `aliases`/`ip`
  fields, regardless of what the client-side jQuery `.data()` API looks
  capable of exposing. This isn't a client bug or an oversight to work
  around — it's server-enforced payload shaping.
- The `checkModules` chain-and-DENY mechanism (A2) is the same general
  pattern used for chat's `onUserPreChat` hook (`WS-074 §1, §9`) and
  join-time ban checks (`WS-074 §4`) — one mechanism, multiple uses.
- `MAX_ITEMS` and `playlist.update-interval` are both server-config
  values (`Config.get(...)`), not fixed constants — actual values will
  vary by deployment and weren't captured in this pass (would require
  either DB/config access or a live `queueFail` at the boundary to
  determine empirically for a specific server).
