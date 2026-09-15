# WS-079 — Closing the Remaining calzoneman/sync Coverage Gaps

**Authors:** Ed (project owner) & Claude (Anthropic — read the remaining unexamined `calzoneman/sync` modules identified in the last resync pass)

**Date:** 2026-09-09
**Scope:** A full sweep of everything client-script-relevant that hadn't been read yet: the channel module framework and its smaller/niche modules, the exact session-cookie cryptography, the shared list data structure, a few infrastructure files, the complete embed-player family, the full media-type registry, and the non-leader playback sync algorithm. Deliberately scoped to what matters for writing CyTube room scripts — server-ops-only internals (database schema, Redis clustering, ACP web routes) are addressed at the end as an explicit, reasoned exclusion rather than silently skipped.

---

## 1. The channel module framework — the pattern everything else is built on

`src/channel/module.js` defines the base class every channel feature (chat, playlist, permissions, kickban, polls, etc.) extends. It's a lifecycle-hook system with a small, fixed set of events: a user attempting to join, a user accepted into the channel, a user leaving, a chat message being sent, and a media change about to happen or having happened. Each hook can return one of three codes — proceed normally, deny, or error — which is how modules cooperatively gate behavior (e.g. a locked/passworded channel denies join until the right condition is met). Understanding this pattern retroactively explains the shape of every other channel module already documented in the WS-0xx series — they're all implementations of the same small interface, not independent one-off designs.

Three smaller modules built on this framework, previously unexamined:

- **`accesscontrol.js`** — channel password gating. On join, if a password is set and the supplied one doesn't match, the joining socket is put in a holding state: it's told a password is needed, and it can pass either by later authenticating as a moderator-or-above account, or by submitting the correct password over the socket. Only once one of those succeeds does the join actually complete.
- **`anonymouscheck.js`** — a simpler gate: if the channel has the "block anonymous users" option set, an unauthenticated (guest) join is held until the user logs in.
- **`drink.js`** — the "drink game" feature (the module's own comment calls it a legacy niche feature kept for backward compatibility). Chat messages starting with `/d` are parsed for an optional count, added to a running per-channel drink counter that's broadcast to everyone, and the counter resets whenever the media changes. Chat messages sent this way get a special CSS class and are forced to show the sender's name — useful to know if a userscript is trying to style or filter chat messages, since this is one of a few built-in mechanisms (alongside your own theming) that already tags messages with extra metadata.
- **`mediarefresher.js`** — periodically re-resolves a playing video's direct source link for exactly one provider (Vimeo), because Vimeo's direct links expire. Only fires when a server-side "vimeo-workaround" config flag is enabled. Not relevant to most channels, but explains a legitimate reason a video's underlying source link can silently change mid-playback for reasons unrelated to anything in the room itself.

## 2. Session cookie cryptography — fully closes WS-024

`src/session.js` shows the exact construction of the `auth` cookie referenced back in WS-024 and WS-077. A session token is `name:expiration:salt:hash:global_rank` (or a 4-part legacy form without the rank), where the hash is a salted SHA-256 digest built from the account name, the account's *password hash* (not the plaintext), the expiration, and the salt. Verifying a session means recomputing that same hash server-side from the claimed name/expiration/salt and comparing it — so a session token is only valid as long as the account's password hash hasn't changed (changing your password invalidates every existing session token everywhere, not just the current device) and only until its embedded expiration passes.

## 3. Shared linked-list backbone (`src/ullist.js`)

Both the playlist and the userlist are backed by the same generic doubly-linked-list implementation, keyed by a `uid` field on each item (`findVideoId` is the playlist-specific helper riding on the same generic `find`/`insertAfter`/`insertBefore`/`remove` structure the userlist uses too). Not something you'd need to touch directly from a room script, but useful context: playlist reordering and userlist updates share identical big-O behavior and edge-case handling under the hood.

## 4. Small infrastructure pieces

- **`tor.js`** — maintains a locally-cached (refreshed daily) list of known Tor exit-node IPs, checked during socket connection setup (referenced already in WS-077's `ioserver.js` coverage) to flag connections as Tor traffic. Purely a server-side risk signal, not exposed to clients.
- **`switches.js`** — a trivial generic on/off flag store with an admin console command to toggle any named flag. Notably, nothing in the current codebase actually checks any specific flag name — it exists as a mechanism for future/ops use, not an active feature today.
- **`camo.js`** — image-proxying for chat. Any `<img>` tag's `src` gets rewritten: if the domain is on a server-configured whitelist, it's just upgraded to HTTPS; otherwise it's rewritten into a signed proxy URL (HMAC-based, matching the open-source "camo" image-proxy convention) pointing at a separate image-proxy server. Relevant if a userscript or channel CSS/JS ever injects images into chat — non-whitelisted image domains will always be silently rewritten to go through this proxy rather than loading directly.

## 5. The complete embed-player family, full media-type registry, and the non-leader sync algorithm

This closes out the player architecture picture started in WS-077 (video.js/HLS/raw-file) and WS-078 (PeerTube).

**Shared bases:** most third-party-hosted providers funnel through one of two thin base classes — a generic `EmbedPlayer` (a plain iframe wrapper, with a mixed-content warning if an HTTPS page tries to embed a plain-HTTP source) or `PlayerJSPlayer` (a wrapper around the third-party `playerjs` postMessage-based control protocol). Odysee and Streamable both extend `PlayerJSPlayer`; Livestream.com, Twitch Clips, and user-pasted custom embeds (`CustomEmbedPlayer`, media type `cu`) all extend `EmbedPlayer`. Every one of them wires the same leader-only pattern already confirmed for video.js in WS-077: on the underlying player's "ended" event, only the leader emits `playNext`; only the leader broadcasts `sendVideoUpdate()` on play/pause.

**`customembed.js` (server side)** is how a raw pasted `<iframe>` tag becomes the `cu` media type: the HTML is parsed, only an `https:` iframe source is accepted, and the media's ID is a SHA-256 hash of the exact raw HTML submitted — so pasting the identical embed code twice always produces the same media identity, but any change to the markup (even whitespace) is a new one.

**The full type registry** (from `player/update.coffee`'s dispatch table) ties every media-type code seen across the whole research series to its player class in one place: `yt`→YouTube, `vi`→Vimeo, `dm`→Dailymotion, `gd`→Google Drive, `fi`→raw file, `sc`→SoundCloud, `li`→Livestream.com, `tw`/`tv`→Twitch, `cu`→custom embed, `rt`→RTMP, `hl`→HLS, `sb`→Streamable, `tc`→Twitch Clip, `cm`→custom media manifest (fed through the same video.js path as HLS/raw-file), `pt`→PeerTube, `bc`/`bn`→a generic sandboxed iframe-child player, `od`→Odysee, `nv`→Niconico.

**The non-leader synchronization algorithm** (also in `update.coffee`) is the other half of the leader/playNext story: a non-leader receiving a media-time update does nothing if it's the leader or if the user has synchronization turned off; otherwise it compares its own current playback time against the leader's reported time, and only seeks if the difference exceeds the user's configured sync-accuracy tolerance — seeking exactly to the reported time if behind, but seeking to slightly past it if ahead (to avoid needlessly re-buffering), with special-cased tolerances for YouTube (a documented race condition around rapid play/seek/pause calls) and Dailymotion (imprecise seeking due to keyframe placement). A negative reported time is a deliberate protocol convention meaning "load but don't play yet," used to let a newly-loaded video buffer before playback actually starts.

## 6. Chat HTML sanitization (`src/xss.js`)

Chat/channel-motd HTML is passed through the `sanitize-html` library with CyTube's defaults extended by a modest allowlist of additional tags (mostly harmless inline/structural ones, plus a deliberately-regretted `marquee` kept for backward compatibility per the code's own comment) and a small set of additional attributes including `style`, `class`, and `data-*`. This is the actual, current gate on what markup a channel's custom CSS/JS or MOTD content is allowed to inject into chat — useful to know precisely which tags/attributes are safe to rely on versus which will be silently stripped.

---

## Explicitly out of scope (reasoned exclusion, not an oversight)

The remaining unexamined files are server-operations concerns with no bearing on writing a CyTube room script, and are being deliberately left uncovered:

- **Database/persistence layer** (`src/database/*`, `src/db/*`) — MySQL schema and query logic for accounts/channels/bans; irrelevant to anything observable or scriptable from the browser.
- **Web/ACP routes** (`src/web/*`) — the account management and admin-control-panel HTTP surface (login, registration, channel settings pages); none of this is reachable or relevant from within a room's own chat/playlist/socket surface.
- **Clustering/partitioning internals** (`src/partition/*`, `src/io/cluster/*`, Redis/pubsub) — how a multi-server CyTube deployment assigns channels to physical servers. The client-facing result of this (the `/socketconfig` endpoint) is already fully documented in WS-077; the internal assignment logic itself has no client-visible behavior beyond that.
- **Misc utility helpers** (`src/util/*`, most of `src/utilities.js`) — generic helpers (hashing, throttling, async helpers) with no protocol-level behavior worth documenting on their own.

If a future task specifically touches one of these areas, it's worth a targeted read at that time rather than documenting it preemptively with no concrete question driving it.

---

## Status update

With this pass, the client-script-relevant surface of `calzoneman/sync` (Socket.IO transport, auth, permissions/ranks, playlist/leader lifecycle, every channel module, every media type and player, chat sanitization, and multi-server discovery) is now comprehensively covered. Future `calzoneman/sync` research should be need-driven (a specific new question) rather than general sweep-driven.
