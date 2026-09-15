Human Project Lead: William / AI: Claude Sonnet 5 (Anthropic)
Status: WORKING / SCRATCH LAYER

# CyTube Upstream Source Deep Dive — calzoneman/sync

Analysis of the actual CyTube open-source server codebase (github.com/calzoneman/sync), cross-referencing against the duckwerks/cytube-knowledge reverse-engineering work. This closes/confirms several long-standing open questions using real server source rather than black-box client observation.

---

## 0. Branch warning

`master` is a frozen 2014 snapshot (CyTube v2.4.6, 82 files). All live development is on the **`3.0`** branch — current version **v3.86.1**, dated Nov 2025, 274 files. Any prior source-browsing against `master` was against 11-year-old code. Use `3.0` going forward:
`https://codeload.github.com/calzoneman/sync/tar.gz/refs/heads/3.0`

---

## 1. Chat flood / rate-limit — CLOSED (was priority gap #1)

Two independent, layered mechanisms found in server source:

### Connection/event-level — `src/io/ioserver.js`
- Generic `TokenBucket(capacity, refillRate)` class (`src/util/token-bucket.js`): capacity refills over time; each `.throttle()` call either consumes a token or returns `true` (rate-limited) if empty.
- Per-IP connection-attempt throttle: `new TokenBucket(5, 0.1)` — capacity 5, refills 0.1/sec. Rejects new socket.io connections that exceed this.
- Per-socket general event throttle: `new TokenBucket(capacity, refillRate)` where capacity/refillRate come from config (`io.throttle.bucket-capacity`, `io.throttle.in-rate-limit`). Triggered via a custom `cytube:count-event`. Violation -> `socket.emit("kick", {reason: "Rate limit exceeded"})` + disconnect.
- Separate `io.ip-connection-limit` config caps simultaneous connections per IP.

### Chat-message-specific — `src/channel/chat.js` + `src/utilities.js`
`user.chatLimiter = util.newRateLimiter()` — one instance per connected user. Algorithm (`newRateLimiter().throttle(opts)`):
```
opts = { burst, sustained, cooldown = burst/sustained }
- if now > lastTime + cooldown*1000: reset count=1, allow
- else if count < burst: count++, allow
- else if (now - lastTime) < 1000/sustained: DENY (rate limited)
- else: allow
```
Hard floor, always applied regardless of channel settings (`MIN_ANTIFLOOD`):
```
burst: 20, sustained: 10 messages/sec
```
Channel-configurable layer (`chat_antiflood` toggle in `src/channel/opts.js`), applies only when `user.account.effectiveRank < 2` (i.e., not moderator+):
```
default: burst 4, sustained 1 msg/sec, cooldown = burst/sustained (4s default)
server clamps: burst <= 20, sustained <= 10 regardless of what channel owner sets
```
On violation: `user.socket.emit("cooldown", 1000 / antiflood.sustained)` — tells client exact ms to wait before retry. Separate `"noflood"` event is a generic feedback event also reused for unrelated command-syntax errors (e.g. in `ranks.js`) — not exclusively a flood signal.

---

## 2. Leader assignment / autolead — RESOLVED (extends WS-072/WS-073)

Source: `src/channel/playlist.js`, `handleAssignLeader`.

Matches WS-072 client trace exactly:
```
client emit "assignLeader" {name} -> server validates canAssignLeader (permissions.leaderctl, rank>=2)
 -> this.leader = matching user -> broadcastAll("setLeader", name)
```

**New detail not visible from client-side testing:** becoming leader auto-boosts the leader's `effectiveRank` to 1.5 if it was below that:
```js
if (this.leader.account.effectiveRank < 1.5) {
    this.leader.account.oldRank = this.leader.account.effectiveRank;
    this.leader.account.effectiveRank = 1.5;
    this.leader.emit("effectiveRankChange", 1.5, this.leader.account.oldRank);
    this.leader.socket.emit("rank", 1.5);
}
```
This is *why* `playlistadd`/`playlistaddlist`/`playlistaddlive` sit at exactly threshold 1.5 (WS-068) — leadership and playlist-edit rank are deliberately linked. Rank reverts to `oldRank` when leader status is removed.

**Autolead answer (closes WS-073's open `autoleadRuntimeBehaviorObserved: false`):**
```js
PlaylistModule.prototype.onUserPart = function (user) {
    if (this.leader === user) {
        this.leader = null;
        this.resumeAutolead();
    }
};

PlaylistModule.prototype.resumeAutolead = function () {
    this.channel.broadcastAll("setLeader", "");
    if (this.current !== null) {
        this.current.media.paused = false;
        this.sendMediaUpdate(this.channel.users);
        if (!this._leadInterval && this.current.media.seconds > 0) {
            this._lastUpdate = Date.now();
            this._leadInterval = setInterval(this._leadLoop.bind(this), 1000);
            this._leadLoop();
        }
    }
};
```
**Conclusion: CyTube does NOT promote another client to leader automatically.** When the leader disconnects, the server falls back to its own server-authoritative timing loop (`_leadLoop`, 1-second ticks, tracks `currentTime` itself, calls `_playNext()` 2 seconds after computed end-of-media "to allow slightly off-sync clients to catch up"). "Autolead" = server takes over timing, not peer handoff.

---

## 3. Media sync / auto-advance — cross-validated + extended (WS-062–067)

Server confirms client-side reverse engineering was fully accurate:
- `handleMoveMedia` operates on `this.items.find(data.from)` / `data.after` — **UIDs, not array indexes**. Exact match to WS-062.
- `setCurrent` broadcast: `this.channel.broadcastAll("setCurrent", uid)` — exact match.
- Auto-advance is genuinely **dual-path**, refining (not contradicting) WS-067's "leader-gated" finding:
  - **With a leader:** leader's client-side player end-of-media handler emits `playNext` (WS-067, client-proven).
  - **Without a leader (autolead/server mode):** the server's own `_leadLoop` independently tracks time and calls `_playNext()` itself once `currentTime >= media.seconds + 2`.
  - Both paths converge on the same server-side `_playNext()` -> advances to `next` playlist item -> `startPlayback()`.

---

## 4. Permission thresholds — exact match, zero deviation (WS-068)

`src/channel/permissions.js` default rank map (byte-for-byte match to what WS-042/WS-058/WS-068 reverse-engineered from the client):
```
seeplaylist: -1
playlistadd: 1.5        playlistaddlist: 1.5      playlistaddlive: 1.5
playlistdelete: 2        playlistaddcustom: 3       playlistaddrawfile: 2
leaderctl: 2
oplaylistadd: -1         oplaylistdelete: 2         oplaylistaddlist: 1.5
```
(There is a second, more permissive default block further down the file — appears to be an alternate/legacy permission template with e.g. `leaderctl: 0` — not yet fully characterized; flag for future investigation if relevant.)

---

## 5. CSS/JS customization — partially cross-checked (WS-030)

`src/channel/customization.js`: server stores channel CSS/JS as plain strings, hashes each with MD5 (`hash('md5', val, 'base64')`) for change detection/caching, and delivers them to clients on load. Server-side gating is only on **who can set** CSS/JS (`canSetCSS`/`canSetJS` permission checks, not yet fully characterized) — there is no server-side gate on which clients receive/run it. This confirms WS-030's finding that the actual allow/deny gate (`checkScriptAccess()`, `channel_js_pref` localStorage key) is purely client-side, living in the built client bundle (`www/js/octopus/`), not in server source. Have not yet opened that client bundle directly from upstream to compare against your reverse-engineered version.

---

## 6. Not yet examined (future work)

- `www/js/octopus/` — the actual built/bundled client-side JS. This is the authoritative upstream source for everything previously reverse-engineered via black-box client observation (event names, DOM structure, the JS permission gate). Comparing it directly against your WS-0xx findings would be extremely high value.
- `src/partition/*` — multi-server channel partitioning/sharding system. Not relevant to a single-server deployment but good to know it exists if scaling ever comes up.
- `src/channel/filters.js`, `src/channel/poll.js`, `src/channel/voteskip.js`, `src/channel/kickban.js` — untouched this pass.
- `src/channel/emotes.js`, `src/channel/library.js` — untouched.
- The second/alternate permission default block in `permissions.js` (~line 359+) — purpose not yet confirmed (legacy default? open-channel preset?).

---

## 7. Recommended follow-ups

1. Update WS-073's `autoleadRuntimeBehaviorObserved` field from `false` to reflect the confirmed answer above (server-authoritative fallback, not peer handoff) — cite this document/upstream source as the resolving evidence.
2. Pull `www/js/octopus/` from the `3.0` branch and diff it against the existing WS-0xx client-side findings — likely the single highest-value remaining piece of upstream source to check.
3. Note for HiveStream: the server's own `_leadLoop` autolead behavior means a P2P sync layer built purely around "who is CyTube's leader" needs to also account for the no-leader / server-authoritative timing mode, since playback continues without any client driving it.

---

*End of document.*
