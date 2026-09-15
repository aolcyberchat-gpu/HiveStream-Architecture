# WS-077 — CyTube Server Deep Dive: CSS/JS Customization, Media Resolution, Networking, Access Control & Config Defaults

**Authors:** Ed (project owner — Termux/Kiwi reverse-engineering, GitHub knowledge base curator) & Claude (Anthropic — full source read of `calzoneman/sync`)

**Purpose of this document:** Reference artifact for `duckwerks/cytube-knowledge`, written so any LLM (Claude, ChatGPT, or otherwise) can work from CyTube's actual server behavior instead of re-deriving it. This is a companion to `WS-074` (chat/emotes/filters/moderation/library/opts/poll/voteskip/drink), `WS-075` (channel.js core lifecycle + playlist.js), and `WS-076` (user/account session model + media type basics). Those covered the modules most tied to permissions and playback sync; this covers everything upstream and around them: how channel CSS/JS actually gets stored and pushed, how every media source type gets resolved server-side, the raw networking/CORS layer, channel access control, and the server's tunable defaults.

**Source:** `calzoneman/sync` (https://github.com/calzoneman/sync) — `src/channel/customization.js`, `src/get-info.js`, `src/custom-media.js`, `src/customembed.js`, `src/media.js`, `src/io/ioserver.js`, `src/web/routes/socketconfig.js`, `src/channel/accesscontrol.js`, `src/channel/anonymouscheck.js`, `src/channel/mediarefresher.js`, `src/session.js`, `src/xss.js`, `src/config.js` — ground truth, not inferred from client scraping.

---

## PART A — Channel CSS/JS customization (`customization.js`) — directly relevant to this project's entire deployment model

This project's whole workflow depends on CyTube's channel JS/CSS injection. There are **two separate mechanisms**, gated by different permissions and with different limits — worth being precise about which one is in play:

### A1. The internal CSS/JS box (`CustomizationModule` — this file)
- Socket events: `setChannelCSS` / `setChannelJS` (inbound), `channelCSSJS` (outbound, pushes `{css, cssHash, js, jsHash}` to every client on join and on any change).
- **Hard 20,000-character cap**, silently truncated server-side (`data.css.substring(0, 20000)`), not rejected with an error. If a script pasted directly into this box ever silently stops working past a certain length, this is why.
- Gated by `canSetCSS`/`canSetJS` (channel-admin permission, i.e. `effectiveRank >= 3` per the `WS-068` permission map) — attempting this without permission gets the socket **kicked**, not just ignored (`"Attempted setChannelCSS as non-admin"`).
- Change detection is via an **MD5 hash of the content** (`cssHash`/`jsHash`), computed via `util/hash.js`, so the server only re-broadcasts to all clients when the content actually changes — not on every save.
- This is almost certainly **not** the mechanism this project uses day-to-day (the jsDelivr workflow uses the *external* JS/CSS fields below), but it's useful to know it exists and that it has a real length ceiling, in case a room is ever found using it instead.

### A2. The external CSS/JS URL fields (`opts.js`, confirmed in `WS-030`, cross-checked here)
- These are plain string **URLs**, not content — the actual CSS/JS text lives wherever the URL points (jsDelivr, in this project's case) and is fetched client-side.
- Gated by `effectiveRank >= 3` (`"externalcss" in data && user.account.effectiveRank >= 3`), same as `pagetitle`, `show_public`, `password`, `torbanned`, `allow_ascii_control`, and `playlist_max_per_user` — i.e. all channel-admin-only options live behind the same rank check in `opts.js`.
- No length cap on the URL string itself (it's just a string field), and no server-side validation of the URL's scheme/host — the server just stores and republishes whatever string is given. The `checkScriptAccess()`/`JSPREF`/`localStorage['channel_js_pref']` consent gate documented in `WS-030` is entirely a **client-side** safety prompt; the server does not enforce anything about what the external URL points to.

**Practical implication:** the jsDelivr `@main` vs pinned-commit distinction from this project's own conventions matters more than any server-side caching — the server just stores the URL string verbatim and never touches the content at that URL. Cache-busting/version pinning is entirely this project's own concern, not something CyTube manages.

---

## PART B — Full media-source-type registry (`get-info.js` `Getters` object) — supersedes/extends the type list in `WS-076`

`WS-076` documented the `Media` object shape and referenced the type registry generally; this is the **complete dispatch table** CyTube's server uses to resolve every playlist item, keyed by the 2-letter type code sent in `queue`/`playlistaddlist` events:

| Code | Source | Notes |
|---|---|---|
| `yt` | YouTube video | Requires `Config.get("youtube-v3-key")` — **fails outright with a config error if no API key is set.** |
| `yp` | YouTube playlist | Same API key requirement. |
| `vi` | Vimeo | — |
| `dm` | Dailymotion | — |
| `sc` | SoundCloud | — |
| `li` | Livestream.com | — |
| `tw` | Twitch (channel) | — |
| `tv` | Twitch VOD | — |
| `tc` | Twitch clip | Legacy; `media.js`'s `pack()` explicitly strips `meta.direct` for this type since 2020-01-26 (Twitch API change). |
| `rt` | Raw RTMP stream | Title hardcoded to `"Livestream"`, duration `"--:--"`. No further validation. |
| `hl` | Raw HLS stream | **Must be HTTPS** — server rejects `http://` HLS URLs outright with a browser-security-policy error message. |
| `cu` | **Custom embed** | See Part C — arbitrary `<iframe src="https://...">` embedding. |
| `gd` | Google Drive (labeled `"google docs"` in source comments, `mediaTypeMap` calls it `"googledrive"`) | ID must match `^[a-zA-Z0-9_-]+$`. |
| `fi` | Raw file via `ffmpeg`/`ffprobe` | **Disabled by default** — `config.js` default is `ffmpeg: { enabled: false }`. A server admin must opt in. |
| `sb` | Streamable | ID must match `^[\w-]+$`. |
| `pt` | PeerTube (federated network) | — |
| `cm` | **Custom media** (JSON manifest) | See Part C — this project's most relevant finding. |
| `bc` | BitChute | — |
| `od` | Odysee | — |
| `bn` | BandCamp | Supports a `thumbnail` field in packed metadata (one of only two types that do, per `media.js`). |
| `nv` | Niconico (`nicovideo.jp`) | — |

All lookups other than `rt`/`hl`/`cu`/`fi`/`cm` go through `@cytube/mediaquery` provider modules (a separate published package, not in this repo) — if a provider ever breaks, the actual scraping/API logic to fix lives in that package, not in `calzoneman/sync` itself.

---

## PART C — The two "bring your own content" mechanisms, and why `cm` is the important one for this project

### C1. Custom embed (`cu`, `customembed.js` — 46 lines total, read in full)

Extremely permissive and extremely simple:
```js
function filterIframe(tag) {
    if (!/^https:/.test(tag.attribs.src)) {
        throw new Error("Invalid embed. Embed source must be HTTPS...");
    }
    return { embed: { tag: "iframe", src: tag.attribs.src } };
}
```
The **entire** server-side validation is: input must parse as HTML containing an `<iframe>` tag, and that iframe's `src` must be `https://`. That's it — no domain allowlist, no content inspection. Gated by `playlistaddcustom` (`effectiveRank >= 3` per `WS-068`).

**Implication for HiveStream/any custom player work:** a channel admin can queue an arbitrary HTTPS iframe as a "video." This means a fully custom player page — e.g. a static page hosted on GitHub Pages or served via jsDelivr that runs `p2p-media-loader` + `hls.js` internally — could be queued directly as a `cu` custom-embed item, with **zero CyTube player.js integration work required.** This is a legitimate, native, already-supported path to running a completely custom player inside a CyTube room, separate from (and much simpler than) hooking `player.js`.

### C2. Custom media (`cm`, `custom-media.js` — 331 lines, read in full) — likely the single most useful finding in this document for the HiveStream pivot

This is CyTube's **native multi-quality/adaptive video system**, and it lines up almost exactly with the Sept 8 HiveStream architecture decision to standardize on `p2p-media-loader` + HLS.js:

- A `cm` playlist item is just a **URL to a JSON manifest**. The server fetches it server-side (SSRF-guarded, see below), validates it, and republishes the parsed result to clients.
- **Manifest schema** (enforced by `validate()`):
  ```json
  {
    "title": "string, required, non-blank",
    "duration": "number, required, >= 0 (0 if live)",
    "live": "boolean, optional",
    "thumbnail": "URL string, optional",
    "sources": [
      { "url": "https URL", "contentType": "video/mp4 | application/x-mpegURL | application/dash+xml | ...", "quality": 240|360|480|540|720|1080|1440|2160, "bitrate": "number, optional" }
    ],
    "audioTracks": [ { "url": "...", "contentType": "audio/...", "label": "string" } ],
    "textTracks": "...",
    "fonts": "..."
  }
  ```
- **`contentType` explicitly includes `application/x-mpegURL` (HLS) and `application/dash+xml` (DASH)** — CyTube's player already knows how to consume both formats through this mechanism, which is exactly the playback stack (HLS.js) the Sept 8 architecture doc settled on.
- **SSRF protections on every URL in the manifest** (`validateURL`): must be `https:` (no plain HTTP), and **the hostname must be a domain name, not a raw IP** (`net.isIP(url.hostname)` check). A `cdn.jsdelivr.net` URL satisfies both constraints natively — this project's existing jsDelivr hosting pattern is already compatible with zero changes.
- **Manifest fetch limits:** must respond `200 OK` with `Content-Type: application/json`, and the response body is capped at **100KB** (`buffer.length > 100 * 1024` aborts the request) — the manifest itself must stay small; it's a pointer document, not a place to embed anything bulky.
- Gated by `playlistaddcustom` (rank ≥ 3), same as custom embeds.

**Direct connection to the HiveStream pivot:** the Sept 8 architecture decision to use `p2p-media-loader` in front of HLS.js means the actual video delivery is an HLS `.m3u8` playlist URL. That URL, once produced, could be published as the `sources[0].url` (`contentType: "application/x-mpegURL"`) in a `cm` manifest — meaning **CyTube's own playlist/queue system could carry a HiveStream stream natively**, with no custom embed/iframe layer needed at all, as long as the manifest and the referenced media URLs are HTTPS domain names (which jsDelivr/GitHub Pages/any real CDN satisfy). This is worth testing empirically as an alternative or complement to the iframe (`cu`) approach in Part C1.

---

## PART D — Networking layer (confirms and closes several `WS-0xx` client-side protocol tests)

From `src/io/ioserver.js` and `src/web/routes/socketconfig.js`:

- **`GET /socketconfig/:channel.json`** — validates the channel name (`isValidChannelName`), then asks the cluster client which Socket.IO server that channel is currently assigned to, and returns that config as JSON. This is the exact mechanism `WS-051` (`CYTUBE-SOCKETCONFIG-ORIGIN-TEST`) was reverse-engineering from the client side — now confirmed server-side. Multi-server CyTube deployments (like the public cytu.be) route different channels to different Socket.IO backends via this endpoint; a single-server deployment would just always return the same config.
- **Engine.IO server options** (`bindTo`):
  - `pingTimeout: 120000` (2 minutes) — deliberately raised from the Engine.IO default of 20s specifically to avoid spurious reconnects on flaky connections (referenced issue: calzoneman/sync#780). **Relevant to this project's mobile-data WebRTC/TURN testing** — CyTube's own socket layer is already tuned to tolerate exactly the kind of transient mobile network hiccups this project's `WebRTC TURN Relay Tester` files were investigating for the P2P layer.
  - `perMessageDeflate: false` and `httpCompression: false` — CyTube deliberately disables WebSocket compression; frames are small enough that compression isn't worth Node's memory-fragmentation risk under concurrency. Anything sniffing/comparing WebSocket frames should not expect `permessage-deflate` to be negotiated.
  - `maxHttpBufferSize: 1 << 20` (1MB) — hard cap per Engine.IO packet.
  - `allowEIO3: true` — the server still accepts Engine.IO protocol v3 clients (older Socket.IO v2 clients/bots), not just v4. This explains why some of this project's earlier raw-handshake fingerprinting tests (`WS-009` through `WS-021`) may have seen protocol-version flexibility rather than a single hard-locked version.
  - **CORS**: origin must be in `Config.get('io.cors.allowed-origins')` (plus the server's own default origins), and the check **strips the port number before comparing** (`origin.replace(/:\d+$/, '')`) — i.e. CyTube treats `https://example.com:8080` and `https://example.com:9090` as the same origin for CORS purposes, only the scheme+hostname matter. `credentials: true` is set, meaning cookies are sent with the Socket.IO handshake (this is how session-based auto-login into a channel works over the socket, not just over plain HTTP).

---

## PART E — Access control & anonymous-user gating (`accesscontrol.js`, `anonymouscheck.js`)

- **Channel password flow**, confirmed event names: server emits `needPassword` (with a boolean indicating whether a wrong password was already tried) → client can either wait to be promoted to mod (`effectiveRank >= 2` bypasses the password entirely, server emits `cancelNeedPassword`) or emit `channelPassword` with an attempt. Wrong attempts just re-emit `needPassword`; there's no visible rate limit/lockout on repeated password guesses at this layer (worth treating any password-protected test room as brute-forceable unless another layer throttles it).
  - A user who disconnects while still waiting on the password prompt is cleanly denied (`ChannelModule.DENY`) rather than left in limbo.
- **`block_anonymous_users` option**: if set, an anonymous (not-logged-in) socket gets an `errorMsg` ("This channel has blocked anonymous users...") and is held at the join gate until it authenticates — it isn't kicked outright, just parked until `Flags.U_LOGGED_IN`.

---

## PART F — Server config defaults worth knowing (`src/config.js`)

These are the out-of-the-box defaults; a specific server (including the public cytu.be) may override any of them, but they're useful as a baseline for what "should" be true absent evidence otherwise:

| Setting | Default | Notes |
|---|---|---|
| `max-chat-message-length` | 320 | Global cap before any channel-specific option. |
| `guest-login-delay` | 60 (seconds) | Per-IP guest-login cooldown, confirms `WS-076`'s inference. |
| `playlist.max-items` | 4000 | Hard ceiling on playlist length. |
| `playlist.update-interval` | 5 (seconds) | |
| `poll.max-options` | 50 | |
| `io.ip-connection-limit` | 10 | Max simultaneous socket connections per IP. |
| `max-channels-per-user` | 5 | |
| `max-accounts-per-ip` | 5 | |
| `ffmpeg.enabled` | `false` | Confirms: the `fi` (raw file) media type is **opt-in per server**, not available by default. |
| `vimeo-workaround` | `false` | Gates `mediarefresher.js`'s Vimeo direct-link refresh — also opt-in. |
| `reserved-names.usernames` / `.channels` | `^(.*?[-_])?admin(istrator)?([-_].*)?$`, `^(.*?[-_])?owner([-_].*)?$` | Confirms `WS-076`'s guess about the reserved-name blacklist pattern — it's a blanket "admin"/"owner" regex, not a curated list of specific words. |
| `aliases.max-age` | 2592000000 ms (30 days) | How long username→IP alias records are retained. |

---

## PART G — Session/auth token format (`session.js`) and chat/MOTD sanitization (`xss.js`)

- **Persistent login ("remember me") token** — one of the open items flagged in the 2026-09-05 `REPO-INDEX.md` — is confirmed here: `name:expiration:salt:hash` (colon-joined), where `hash = sha256(name + account.password_hash + expiration + salt)`. Critically, **the account's password hash is baked into every session token's HMAC input** — this means **changing your account password server-side invalidates every existing "remember me" session everywhere**, not just on the device where the password was changed. Good to know if a persistent-login room ever mysteriously logs everyone out at once.
- **Chat/MOTD HTML sanitization allowlist** (`xss.js`, on top of `sanitize-html`'s defaults): additional allowed tags include `img`, `span`, `font`, `button`, `center`, `marquee`, `details`/`summary`, `h1`/`h2`, `template`, `sub`/`sup`, `s`, `cite`, `section`, `small`. Additional allowed attributes (applied broadly, not just to specific tags) include **`style`, `class`, `id`, `data-*`, `role`, `aria-*`**. **The `style` attribute is allowed on essentially every extra tag** — meaning inline CSS in chat messages and the MOTD is explicitly supported and sanitized-through, not stripped. This directly matters for the `cytube-myspace` room's mallgoth aesthetic work: MOTD/chat-based inline styling is a real, sanctioned capability, not something being smuggled past the sanitizer.

---

## Summary of what's now closed vs. still open

**Closed by this pass:**
- The full media-source-type registry (Part B) — previously partial.
- Exactly how channel CSS/JS is stored, capped, and permission-gated at the protocol level, and the distinction between the internal box and the external URL field (Part A).
- The `/socketconfig/:channel.json` mechanism (`WS-051`) — now server-confirmed (Part D).
- Engine.IO tuning parameters relevant to the mobile/TURN reliability research (Part D).
- The channel password protocol event sequence (Part E).
- The reserved-username/channel-name regex pattern guessed at in `WS-076` (Part F).
- The persistent-login token format flagged as an open item in the 2026-09-05 `REPO-INDEX.md` (Part G).
- The full sanitized-HTML allowlist for chat/MOTD (Part G).

**New, actionable, and not previously investigated at all:**
- The `cm` custom-media JSON manifest system (Part C2) — a native CyTube mechanism that may let the HiveStream/p2p-media-loader pipeline plug into the playlist system directly, without any custom embed or player.js hooking. **Recommended next test:** stand up a minimal `cm` manifest (single HTTPS HLS source) hosted via jsDelivr, queue it in a test room, and observe whether CyTube's player consumes it via HLS.js as expected.
- The `cu` custom-embed iframe path (Part C1) as a simpler fallback/alternative — a fully custom static player page can be queued directly as an iframe with no server cooperation beyond the HTTPS requirement.
