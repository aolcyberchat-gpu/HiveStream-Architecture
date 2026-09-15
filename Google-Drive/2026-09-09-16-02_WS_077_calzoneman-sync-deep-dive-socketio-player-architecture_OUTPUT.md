# WS-077 — CyTube Server Source Deep Dive: Socket.IO Internals, Multi-Server Discovery, Player Architecture

**Authors:** Ed (project owner) & Claude (Anthropic — cloned and read `calzoneman/sync` directly: `src/io/ioserver.js`, `src/web/routes/socketconfig.js`, `docs/socketconfig.md`, `src/configuration/ioconfig.js`, `player/base.coffee`, `player/videojs.coffee`, `player/hls.coffee`, `player/raw-file.coffee`, `docs/raw-videos.md`, `docs/custom-media.md`, `src/media.js`, `src/custom-media.js`)

**Date:** 2026-09-09
**Test series:** Continuation of the WS-0xx arc. Closes/upgrades WS-011, WS-012, WS-018, WS-019, WS-024, WS-051, WS-052 from inferred/client-observed to **server-source-proven**. Also produces a new, previously-uncaptured finding relevant to the HiveStream P2P engine decision (§3).

---

## 1. Socket.IO server internals (`src/io/ioserver.js`)

Confirmed directly from source, not inferred from client behavior:

- **Ping timeout is hardcoded to 120000ms (2 minutes)**, explicitly raised from the socket.io default of 20s specifically to avoid spurious reconnects on flaky connections (cites `calzoneman/sync#780` in a code comment). This is the authoritative number behind any long-idle-then-reconnect behavior WS-011/WS-012 observed during polling tests.
- **Per-IP connection rate limiting** via a token bucket: capacity 5, refill rate 0.1/sec, enforced in `ipThrottleMiddleware` during the initial handshake. Separately, **`io.ip-connection-limit`** caps concurrent connections per IP at the socket level (`checkIPLimit`) — exceeding it gets you a `kick` event with reason `"Too many connections from your IP address"` and an immediate disconnect. This is almost certainly the exact mechanism `cytube-ring-plug` was hitting before the switch to a static `ring.json` fetch — worth a note in that repo's README linking back here.
- **CORS origin enforcement**: allowed origins come from `io.cors.allowed-origins` config plus the server's own `io.domain`/`https.domain`. The port is stripped before comparison (`origin.replace(/:\d+$/, '')`), and non-browser clients with no `Origin` header are allowed through by default. Anything not on the list gets a hard `next(new Error('Invalid origin'))` — this is the specific rejection path behind the 400 responses in WS-018/WS-019's raw-TLS-socket tests.
- **Auth is cookie-driven, not query-param driven**: the middleware chain reads `socket.handshake.signedCookies.auth`, verifies it server-side via `session.verifySession` (promisified), and attaches the resulting user object to `socket.context.user` *before* `handleConnection` fires. It also separately loads IP-based aliases (`db.getAliases`) regardless of auth state. This confirms and completes WS-024's cookie/session sequence.
- **`allowEIO3: true`** is explicitly set "to support legacy socket.io v2 clients (e.g. bots)" — confirms why raw Engine.IO v3-style handshakes still work against current servers, which several of the early WS-00x tests relied on.
- Metrics/telemetry: every socket is instrumented with Prometheus counters for rate-limit rejections, connection-limit rejections, auth failures, transport type, and upgrade/reconnect events — not directly useful for scripting, but useful context if a channel ever seems to silently throttle you: the server *is* counting and gating on IP, not per-user-account.

## 2. Multi-server / channel partitioning discovery — closes WS-051 / WS-052

`GET /socketconfig/<channel>.json` (`src/web/routes/socketconfig.js`, documented in `docs/socketconfig.md`) is the real, current mechanism (replacing the older `/sioconfig` endpoint as of 2015). Response shape:

```json
{
  "servers": [
    { "url": "https://host:8443", "secure": true },
    { "url": "http://host:1337", "secure": false },
    { "url": "https://host6:8443", "secure": true, "ipv6": true }
  ]
}
```

A 404 with `{"error": "Channel \"X\" does not exist."}` is returned for invalid channel names. The client is free to pick any entry; the docs explicitly recommend the `secure: true` one. This fully confirms and closes the WS-051 (`SOCKETCONFIG-ORIGIN-TEST`) / WS-052 (`SOCKETIO-SERVER-SELECTION-TEST`) open questions — the "which server do I actually connect to" logic is exactly this endpoint, no other discovery mechanism exists.

## 3. Player architecture — video.js is the real production player, not raw HLS.js (relevant correction for HiveStream)

Read the actual pre-compiled CoffeeScript player sources rather than the minified bundle:

- `player/base.coffee` defines the abstract `Player` interface (`load`, `play`, `pause`, `seekTo`, `setVolume`, `getTime`, `isPaused`, `getVolume`, `destroy`) that every player type implements.
- `player/videojs.coffee` (`VideoJSPlayer`) is the shared base for **both** `HLSPlayer` and `FilePlayer`. It:
  - Builds a `<video>` element and hands it to `videojs()` with a `videoJsResolutionSwitcher` plugin.
  - Sorts sources by quality preference from `data.meta.direct` (a map keyed by quality string, e.g. `"480": [{contentType, link}]`), preferring the user's `USEROPTS.default_quality`, and pushes non-FLV sources ahead of FLV ones.
  - Wires up the exact `if (CLIENT.leader) socket.emit('playNext')` on the `'ended'` event, and `sendVideoUpdate()` on `'play'`/`'pause'` when leader — this is byte-for-byte consistent with what WS-067's compiled-bundle analysis found, just now confirmed at the pre-compile source level too.
  - Falls back to the next source in the list on playback error (`error.code === 4`), and if all sources are exhausted for a Google Drive item, prompts the user to install the GDrive userscript.
- `player/hls.coffee` (`HLSPlayer extends VideoJSPlayer`) does almost nothing beyond setting `data.meta.direct = {480: [{link: data.id, contentType: 'application/x-mpegURL'}]}` — quality is arbitrarily fixed at 480 because the actual quality is dictated by the HLS manifest itself, not by CyTube.
- `player/raw-file.coffee` (`FilePlayer extends VideoJSPlayer`) does the same pattern, mapping ffprobe-detected codec strings (e.g. `mov/h264`, `matroska/vp9`) to a MIME type via `codecToMimeType()`.

**Why this matters for HiveStream:** the 2026-09-08 architecture docs frame the integration point as `Video.js → HLS.js 1.x → p2p-media-loader`, implying an independent HLS.js instance sits in the chain. In the actual current codebase, **there is no separate HLS.js instance** — HLS playback goes through video.js's own HTTP-streaming handling, fed a single `application/x-mpegURL` source via the same `data.meta.direct`/`updateSrc()` path as every other player type. Any p2p-media-loader integration needs to either (a) hook into video.js's internal HLS source handler directly (there are existing community plugins that do this, e.g. `p2p-media-loader`'s own videojs integration), or (b) bypass CyTube's built-in `HLSPlayer` entirely and register a custom player type that owns its own HLS.js + p2p-media-loader instance outside video.js. Worth resolving explicitly in the next HiveStream architecture revision — as written, the roadmap assumes a component that doesn't currently exist in this form.

## 4. Native "custom media manifest" extension point (`cm` type) — possible fallback/seed mechanism, not a P2P delivery path

`docs/custom-media.md` documents a fully-supported, no-server-code-required media type (internally `'cm'`, alongside `'bn'` — confirmed together in `src/media.js` line 58's `['bn','cm'].includes(this.type)` check, and `src/custom-media.js` line 149's `new Media(id, data.title, data.duration, 'cm', meta)`). A user submits a link to a public JSON manifest describing:

- Multiple `sources` (URL + MIME type + quality + optional bitrate), supporting `video/mp4`, `video/webm`, `video/ogg`, `application/x-mpegURL`, `application/dash+xml` (experimental), and several audio types.
- Optional `audioTracks` and `textTracks` (WebVTT only, needs CORS headers on the remote host).
- A `live` flag that disables auto-advance timing for livestreams.

**Hard constraint that rules it out as a direct P2P delivery mechanism:** every source/track URL "must resolve to a publicly-routed IP address" and use `https:`. This means it cannot point at anything served only from a browser-local Service Worker or WebRTC data channel with no public endpoint — so it's not usable as HiveStream's actual segment-delivery path. It could still be useful as a **fallback/seed source** (e.g. an origin HLS URL that p2p-media-loader falls back to when no peers are available), since that's exactly the kind of publicly-reachable URL this format expects.

---

## Status update on prior open questions

| Test | Prior status | New status |
|---|---|---|
| WS-011/012 (Engine.IO polling/session continuity) | Client-observed only | Ping timeout (120s) now source-confirmed |
| WS-018/019 (raw WS 400 responses) | Cause unconfirmed | CORS origin-allowlist rejection, source-confirmed |
| WS-024 (cookie/session sequence) | Inferred from cookies observed | Confirmed: `signedCookies.auth` → `session.verifySession` → `socket.context.user`, source-confirmed |
| WS-051/052 (socketconfig/server selection) | Open | Fully closed — `/socketconfig/<channel>.json` is the complete mechanism |
| WS-067 (leader-gated `playNext`/`sendVideoUpdate`) | Confirmed at compiled-bundle level | Now also confirmed at pre-compile `videojs.coffee` source level |

## Recommended next actions

1. Fold this into `duckwerks/cytube-knowledge` as `WS-077-CYTUBE-SYNC-SERVER-DEEPDIVE-FINDINGS.md` when doing the next GitHub sync pass.
2. Flag the video.js/HLS.js discrepancy (§3) to whoever is maintaining the HiveStream architecture docs — it changes the integration point for the p2p-media-loader work.
3. Consider a short addendum to `cytube-ring-plug`'s notes referencing the token-bucket/connection-limit numbers in §1 as the likely root cause of its earlier socket problems.
