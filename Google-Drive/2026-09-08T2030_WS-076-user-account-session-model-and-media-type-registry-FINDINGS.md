# WS-076 — User/Account Session Model & Media Type Registry: Full Server-Source Findings

**Authors:** Ed (project owner — Termux/Kiwi reverse-engineering, GitHub
knowledge base curator) & Claude (Anthropic — source analysis of
`calzoneman/sync`)

**Purpose of this document:** Reference artifact for
`duckwerks/cytube-knowledge`. This covers the layer *below* everything
in `WS-075` — how a raw socket connection becomes a logged-in `User`
with an `Account` and a rank, before a channel is even involved — plus
a complete registry of the media "type" codes used throughout the
playlist system (referenced but not enumerated in `WS-075` §B1).

**Source:** `calzoneman/sync` (https://github.com/calzoneman/sync),
`src/user.js` (session/login), `src/account.js` (rank resolution),
`src/flags.js` (all bitflag constants), `src/media.js`,
`src/utilities.js` (`formatLink`/`isLive`) — ground truth.

---

## PART A — Session lifecycle: socket connects → User → Account → rank

### A1. The `Flags` bitflag registry (complete — every flag in the codebase)
```js
// Channel-level (Flags.C_*)
C_READY      : 1 << 0   // channel finished loading, ready for use
C_ERROR      : 1 << 1   // channel failed to load
C_REGISTERED : 1 << 2   // channel is a persisted/registered channel

// User-level (Flags.U_*)
U_READY             : 1 << 0   // User object constructed and ready
U_LOGGING_IN        : 1 << 1   // login attempt in flight
U_LOGGED_IN         : 1 << 2   // successfully logged in (guest or registered)
U_REGISTERED        : 1 << 3   // logged in with a real registered account (not guest)
U_AFK                : 1 << 4   // currently AFK
U_MUTED              : 1 << 5   // muted (see WS-074 §1)
U_SMUTED             : 1 << 6   // shadow-muted (see WS-074 §1)
U_IN_CHANNEL         : 1 << 7   // currently joined to a channel
U_HAS_CHANNEL_RANK   : 1 << 8   // per-channel rank has been fetched/applied
```
Every `waitFlag`/`is`/`setFlag`/`clearFlag` call seen throughout
`WS-074`/`WS-075` refers to one of these exact bit values. Worth having
as a single lookup table rather than re-deriving from context each time.

### A2. Connection → account, before any channel exists
On socket connect, a `User` is constructed immediately (`U_READY` set),
**independent of any channel** — channels aren't joined until a
separate `joinChannel` event. Two paths depending on whether
`loginInfo` (a pre-authenticated session, e.g. from a cookie) was
already resolved:
- **Already authenticated** (has `loginInfo`): flags set immediately to
  `U_REGISTERED | U_LOGGED_IN | U_READY`, emits `login` (`{success:
  true, name, guest: false}`) then `rank` (their `effectiveRank`,
  computed from a fresh `Account`).
- **Not yet authenticated**: an `Account` is still constructed (with
  `user: null`), emits `rank: -1` (Anonymous, per the `WS-071`/`WS-073`
  scale) and waits for either a `login` event or a `joinChannel` (some
  channels may allow anonymous browsing before requiring login,
  depending on channel config).

**Global superadmin callbacks** (`initAdminCallbacks`, which wires the
`borrow-rank` handler documented in `WS-073` §1e) are only attached if
`account.globalRank >= 255` **at the moment of login** — this happens
once, right after authentication succeeds, not per-channel-join.

### A3. `joinChannel` validation (before `channel.joinUser` is even called — see WS-075 §A3)
- Channel name must match `util.isValidChannelName`: **1–30 characters,
  `a-z A-Z 0-9 - _` only**. Violating this both shows an `errorMsg` AND
  kicks the socket outright — not a soft rejection.
- A user already in a channel (`inChannel()` true) is silently ignored
  on a second `joinChannel` attempt — no error, just a no-op.
- If the target channel is hosted on a **different server** in a
  multi-server deployment (`EWRONGPART` error code), the user gets an
  `errorMsg` telling them to refresh (their client is using a stale
  routing URL) rather than being silently dropped.

### A4. Guest login validation (`guestLogin`) — full rule set
1. **Rate limit**: one guest login per IP per `Config.get("guest-login-
   delay")` seconds (server-configured cooldown, not per-channel).
2. **Username format**: `util.isValidUserName` — 1–20 characters,
   `a-z A-Z 0-9 - _` only (note: stricter length cap than channel
   names' 30-char limit).
3. **Reserved name check**: rejected if it matches
   `Config.get("reserved-names.usernames")` (a server-configured
   regex/blacklist — e.g. likely blocks names like "admin", "system",
   the site's own bot name, etc., though the actual pattern is
   server-specific config, not hardcoded in this file).
4. **Registered-name collision**: rejected if `db.users.isUsernameTaken`
   — a guest cannot use a name that belongs to a real registered
   account, even if that account isn't currently logged in.
5. **In-channel collision**: rejected if another user (guest or
   registered) is *already present in the same channel* under that
   name (case-insensitive) — this check is channel-scoped, so the same
   guest name could be in use simultaneously in two different channels.
6. On success: `account.guestName` is set, `account.update()` recomputes
   `effectiveRank` (guests get `globalRank = 0`, per `account.js`'s
   `update()` — i.e. **guest is functionally rank 0 = "Guest" on the
   scale**, not the `-1` "Anonymous" tier, which is reserved for
   not-yet-logged-in-at-all).

### A5. Registered login (`login`)
Delegates to `db.users.verifyLogin(name, pw, ...)`. On failure, logs a
`[loginfail]` server-side event specifically for bad-password attempts
(not e.g. nonexistent usernames) — useful context if ever building
anything that consumes server logs. On success: `account.user` is set,
`account.update()` recomputes rank, and critically emits
**`effectiveRankChange`** with both old and new rank — this is the
same event `WS-075` §A7 showed triggers a userlist resend when crossing
the mod/superadmin boundary, and the same event `poll.js`
(`WS-074`/`WS-075` cross-ref) listens to for re-evaluating hidden-poll
room membership.

### A6. `effectiveRank` — the actual computation, confirmed at the source
From `account.js`, `Account.update()`:
```js
this.effectiveRank = Math.max(this.channelRank, this.globalRank);
```
This is the literal, authoritative formula referenced (but not quoted)
in `WS-073` §1d — confirmed here directly from the class that owns it.
`channelRank` defaults to `-1` until a channel is joined and
`setChannelRank` is called (`WS-075` §A3 step 3), so **before joining
any channel, `effectiveRank` is purely the user's `globalRank`.**

### A7. AFK lifecycle (`setAFK`/`autoAFK`) — extends WS-074 §8's voteskip notes
- `autoAFK` (re)starts a timer on every activity-adjacent call, based on
  the channel's `afk_timeout` option (`WS-074` §6; a `0` or invalid
  value disables the timer entirely — no auto-AFK).
- Going AFK **automatically retracts the user's voteskip vote**
  (`voteskip.unvote(realip)`) and emits a dedicated
  `clearVoteskipVote` event to that user's own client — this is a
  detail `WS-074` §8 didn't have: the eligibility-recalculation
  described there is triggered *by* this exact AFK transition, and the
  client is explicitly told to clear its own vote-skip UI state.
- Coming back from AFK simply restarts the auto-timer; going AFK stops
  it (the timer only exists to detect *transition into* AFK, not to
  re-trigger while already AFK).

### A8. Disconnect cleanup (`die`)
On death, **every socket event listener is manually deleted**
(`this.socket._events`), plus the custom `typecheckedOn`/
`typecheckedOnce` helper methods and the user's own EventEmitter
handlers (`__evHandlers`). This is an explicit anti-leak measure — worth
knowing if a custom module ever needs to reason about whether a
disconnected user's handlers might still fire (answer: no, they're
forcibly stripped, not just orphaned).

---

## PART B — Media type registry (`utilities.js` `formatLink`/`isLive`, `media.js`)

This is the complete list of two-letter `type` codes used everywhere in
the playlist system (`WS-075` §B1's `canAddList`/`canAddLive`/
`canAddCustom`/`canAddRawFile` gates all key off these codes).

| Code | Source | Link format (`formatLink`) | Counts as "live" (`isLive`) |
|---|---|---|---|
| `yt` | YouTube | `https://youtu.be/<id>` | no |
| `yp` | YouTube playlist | *(not in formatLink — playlist import path, see WS-075 §B1)* | no |
| `vi` | Vimeo | `https://vimeo.com/<id>` | no |
| `dm` | Dailymotion | `https://dailymotion.com/video/<id>` | no |
| `sc` | SoundCloud | `<id>` (id is already a full URL/reference) | no |
| `li` | Livestream.com | `https://livestream.com/<id>` | **yes** |
| `tw` | Twitch (live channel) | `https://twitch.tv/<id>` | **yes** |
| `rt` | Custom RTMP | `<id>` | **yes** |
| `gd` | Google Drive | `https://docs.google.com/file/d/<id>` | no |
| `fi` | Raw file URL | `<id>` | no |
| `hl` | HLS stream | `<id>` | **yes** |
| `sb` | Streamable | `https://streamable.com/<id>` | no |
| `tc` | Twitch Clip | `https://clips.twitch.tv/<id>` | no |
| `cm` | Custom media (generic embeddable, e.g. audio-capable raw file — see `media.js` thumbnail note below) | `<id>` | no (per `isLive`, though `canAddRawFile` gates `fi`/`cm` together — see `WS-075` §B1) |
| `cu` | Custom embed (arbitrary embed code) | *(no case — falls to `default: ""`)* | **yes** (per `isLive`, somewhat surprising — treated as live for permission-gating purposes even though it's arbitrary embed HTML, not a stream) |
| `pt` | PeerTube | `https://<domain>/videos/watch/<uuid>` (id is `domain;uuid`) | no |
| `bc` | BitChute | `https://www.bitchute.com/video/<id>/` | no |
| `bn` | Bandcamp | `https://<artist>.bandcamp.com/track/<track>` (id is `artist;track`) | no |
| `od` | Odysee | `https://odysee.com/@<user>/<video>` (id is `user;video`) | no |
| `nv` | Niconico | `https://www.nicovideo.jp/watch/<id>` | no |

**`cu` being flagged as "live" by `isLive` is worth flagging explicitly**
— it means custom embeds are subject to `canAddLive`, not a separate
"custom embed" gate for that specific check (though `canAddCustom` is a
*separate additional* gate per `WS-075` §B1 — a custom embed actually
needs **both** `canAddLive` and `canAddCustom` to succeed, since
`handleQueue` checks `isLive(type) && !canAddLive` as one branch and
`type === "cu" && !canAddCustom` as a second, independent branch).

### B1. `Media` object structural notes (`media.js`)
- `title` is hard-truncated to 100 chars (`97 + "..."` if longer) at
  construction — not just display-truncated, actually stored short.
- `seconds` accepts the literal string `"--:--"` as a sentinel for
  "unknown/live duration" and converts it to `0`.
- **Selective metadata persistence** (`pack()`): most `meta` fields are
  always kept, but `meta.direct` is dropped for `gd` (Google Drive) and
  `tc` (Twitch Clip) types specifically (historical: GDrive metadata
  became unused in 2018, Twitch Clip API changed in 2020 per inline
  comments), and `meta.thumbnail` is **only** kept for `bn` (Bandcamp)
  and `cm` (Custom media) — i.e. thumbnails are only meaningful/stored
  for audio-primary or generic custom media types, not video platforms
  (which presumably derive thumbnails from the platform itself, not
  from CyTube's own storage).

---

## Cross-references to prior findings
- Confirms `WS-073` §1d's `effectiveRank = Math.max(...)` formula
  directly from source (A6 above).
- Extends `WS-074` §8 (voteskip AFK exclusion) with the actual trigger
  mechanism: AFK transition explicitly retracts the vote and notifies
  the client (A7 above).
- Extends `WS-075` §B1 (playlist queue permission gates) with the full
  type-code registry those gates operate on (Part B above) — `WS-075`
  named the gates but not the codes; this document is the missing
  lookup table.
- Confirms `WS-073`'s rank scale: guest = effective rank `0` (via
  `globalRank = 0` on guest login, A4 step 6), not-yet-logged-in =
  effective rank `-1` (Anonymous, A2).
