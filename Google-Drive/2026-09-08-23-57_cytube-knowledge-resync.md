# Claude / CyTube-Knowledge Persistent Resync Memory

**Date:** 2026-09-08
**Human Project Lead:** William
**AI Research & Engineering:** Claude Sonnet 5 (Anthropic)
**Status:** WORKING / SCRATCH LAYER (per this project's own HIVESTREAM-PERSISTENT-PROJECT-MEMORY-LAYER convention — GitHub remains canonical; this document is the Drive-side working record of Claude's resync pass)

**Note on attribution:** Other documents in this project sign as "Human Project Lead: Elwood Edwards" / "AI: GPT-5.6 Luna (OpenAI)". This document uses William's actual name (as known from prior Claude conversations) rather than that persona, since it was unconfirmed whether Elwood Edwards is an intentional pen name for the project or specific to the ChatGPT/ "Luna" thread. Reconcile naming convention across documents if needed.

---

## 1. Purpose

This document is Claude's durable orientation record for the CyTube channel-customization / HiveStream reverse-engineering project, produced by a full resynchronization pass across all four known repositories on 2026-09-08. It exists so a future Claude session (or another assistant) does not have to redo this archaeology from scratch. It is a snapshot/analysis document, not a replacement for the deeper artifacts it references.

---

## 2. Repos Covered

1. `duckwerks/cytube-knowledge` — primary reference/reverse-engineering knowledge base (deep dive performed)
2. `backwater-battery/cytube-hivestream` — early P2P-Theater-Core lineage (v0.00.01–0.00.13), confirmed matches prior index, not re-analyzed in depth
3. `backwater-battery/Dadders-cybertube` — Klausfishbowlchat single-channel script (v7.0.01–7.0.07), confirmed matches prior index
4. `aolcyberchat-gpu` (6 repos) — confirmed all live: `cytube-tanks-script`, `cytube-dictionary-assets`, `cytube-myspace`, `P2P-Theater-Core` (separate hivestream4xxx lineage, 40+ files), `cytube-ring-plug`, `Cytube-HLS-minplayer`

---

## 3. Status of the Two Original Priority Knowledge Gaps

### Media sync timing behavior — SUBSTANTIALLY RESOLVED
Full authoritative chain established (WS-062 through WS-067, source + runtime proven):
```
Queue Next click -> socket.emit("moveMedia", {from: uid, after: PL_CURRENT})   [playlist item UIDs, NOT array indexes]
Play / auto-advance -> Callbacks.setCurrent(uid) -> PL_CURRENT updated
                     -> Callbacks.changeMedia(mediaDescriptor)   (~7-26ms after setCurrent)
                     -> Callbacks.mediaUpdate(...) telemetry     (~3s later; currentTime/paused)
```
Auto-advance trigger (WS-067, source-proven across every CyTube player type — YouTube, Vimeo, Twitch, Dailymotion, PeerTube, SoundCloud, NicoNico, PlayerJS): player end-of-media handler does
```js
if (CLIENT.leader) { return socket.emit('playNext'); }
```
Auto-advance is leader-gated. Ordinary viewers never independently trigger it.

### Chat flood / rate-limit behavior — STILL OPEN
No file in any of the four repos addresses this as of 2026-09-08. This remains the top open item from the original knowledge-base priorities.

---

## 4. Leader Assignment Thread (resolved this session)

Previously flagged as an integrity concern: `HIVESTREAM-P2P-MEDIA-LOADER-REUSE-FINDINGS.md` cited a test "WS-072" as proof of the leader-assignment path, but no such file existed in the repo at time of check (confirmed via full recursive git tree, non-truncated). William subsequently added the missing files:

- `WS-071-...-LEADER-PERMISSION-CONTROL-SOURCE-SCAN-TEST` — source scan; discovered previously-uncataloged outbound event **`setPermissions`** (alongside `borrow-rank`, `assignLeader`, `playNext`). Should be folded into the WS-029 outbound event catalog.
- `WS-072-...-LEADER-ASSIGNMENT-RUNTIME-TRACE-TEST` — RUNTIME PROVEN: UI "Give Leader" -> `socket.emit("assignLeader", {name})` -> inbound `setLeader(name)` -> `CLIENT.leader = true`. Explicitly and correctly caveats `serverSourceCodeProven: false` — client round-trip proven, server internals not.
- `WS-073-...-LEADER-REMOVAL-AUTOLEAD-RUNTIME-TRACE-TEST` — confirms reverse path: `assignLeader({name:""})` -> `setLeader("")` -> `CLIENT.leader = false` (~129ms). **`autoleadRuntimeBehaviorObserved: false`** — whether CyTube auto-reassigns leader when the leader disconnects remains UNPROVEN/OPEN.
- `WS-073-...-P2P-MEDIA-LOADER-RUNTIME-DISCOVERY-TEST` (naming collision — also tagged WS-073, should probably have been WS-074) — checked the live CyTube page for existing p2p-media-loader globals; found none. Confirms CyTube has no current p2p-media-loader integration; only the legacy `videojs-hlsjs-plugin.js` is present.

**Conclusion:** the WS-072 citation, once the file existed, was written with proper evidence discipline (SOURCE/RUNTIME/INFERENCE/OPEN separation maintained). The earlier concern was a real process gap (test run but not archived when first cited), not a fabrication.

**Known repo hygiene items (not yet cleaned up, William chose to leave as-is for now):**
- Two unrelated tests both numbered WS-073.
- WS-071 now exists as three overlapping files (bare `TEST.js`, mislabeled `TEST.js.md` containing raw JSON output, and a new timestamped combined script+output file). Per the project's own `TEST-ARTIFACT-CREATION-STANDARD.md`, should collapse to one `TEST.js` + one `TEST-OUTPUT.txt` + one `FINDINGS.md`.
- No `FINDINGS.md` yet exists for WS-071/072/073(x2), unlike WS-062–068 which each got one.

---

## 5. Rank / Permission Map — RESOLVED

WS-042, WS-058, WS-068 together give two corroborating data points:
- Rank 1 (ordinary member): below the 1.5 threshold for most playlist modification — mostly `false`.
- Rank 5: all playlist permissions `true`.

Confirmed thresholds (WS-068):
```
seeplaylist -1 | playlistadd/next/move/jump/addlist 1.5 | playlistdelete 2 | leaderctl 2 | playlistaddcustom 3
```
Confirmed client logic (`hasPermission()`):
```js
function hasPermission(key) {
    if (key.indexOf("playlist") == 0 && CHANNEL.openqueue) {
        var v = CHANNEL.perms["o" + key];
        if (typeof v == "number" && CLIENT.rank >= v) return true;
    }
    var v = CHANNEL.perms[key];
    if (typeof v != "number") return false;
    return CLIENT.rank >= v;
}
```
Important distinction confirmed: `CLIENT.rank` and `CLIENT.leader` are separate runtime concepts — rank alone does not determine leadership.

---

## 6. WebRTC / TURN Network Reality Check (`WEBRTC-NETWORK-TESTING-KNOWLEDGE.md`, previously unread, now reviewed)

Consolidates the April 2026 TURN relay tests and WebTorrent instrumentation:
- **Direct/STUN-assisted WebRTC: demonstrated working.** Real `srflx` ICE candidates, connected DataChannel, actual BitTorrent protocol handshake bytes sent over it.
- **Forced TURN relay (`openrelay.metered.ca`, `iceTransportPolicy: "relay"`): failed in all 4 tested conditions** (mobile data / Wi-Fi-DSL, each with and without VPN).
- Diagnostics were too weak to identify the exact TURN failure stage (DNS? allocation? auth? candidate selection?) — next test needs `getStats()`-level instrumentation.
- Explicit non-inferences: this does NOT prove mobile carriers block WebRTC, VPN blocks WebRTC, or that TURN is universally broken — only that this specific tested configuration failed.

**Relevance to HiveStream's OQ-004** (Android <-> desktop WebRTC stability): direct/STUN path has real supporting evidence; the TURN fallback needed for restrictive NATs (common on mobile carriers) is an unproven, currently-failing path in this project's own testing. Don't assume the browser swarm "just works" on carrier connections without a working relay fallback.

---

## 7. HiveStream Architectural Pivot (2026-09-07/08, via a separate ChatGPT/"GPT-5.6 Luna" thread)

HiveStream re-scoped from the earlier WebTorrent + token/trust/receipt/reputation architecture (`P2P-Theater-Core` v0.00.13 and the `hivestream4xxx.js` lineage in `aolcyberchat-gpu`) toward:

- **Foundation:** Novage `p2p-media-loader`, reused rather than building a custom segment-exchange protocol.
- **Scope:** browser P2P video streaming + persistent local-media reuse + local media ingestion. Tokens, reputation, recommendation graphs explicitly OUT of scope now.
- **MVP proof sequence:** (1) two-browser P2P segment transfer proof -> (2) persistent IndexedDB storage -> (3) persisted-replica-seeds-P2P -> (4) local MP4 ingestion -> (5) CyTube/Video.js/HLS.js adapter.
- **Key technical finding (`HIVESTREAM-P2P-MEDIA-LOADER-REUSE-FINDINGS.md`):** stored segments ARE announced to peers and CAN serve peer uploads directly from storage (source-proven) — but a `P2PLoader` is only created via the normal `Core.loadSegment()` -> `HybridLoader` -> `P2PLoadersContainer` -> `P2PLoader` chain, which is reached through a playback/segment-loading path. Pre-populating storage alone does NOT appear to create a live loader. This narrows (does not fully resolve) the "can pre-seeded local media announce to peers without an HTTP round-trip first" question (OQ-001) — the underlying announcement mechanism is proven; the loader-activation bootstrap for pre-seeded-only streams is still open.
- The two prior lineages (`backwater-battery/cytube-hivestream` v0.00.13, `aolcyberchat-gpu/P2P-Theater-Core` hivestream4035.js) are NOT duplicates of each other — confirmed as two separate historical implementation lineages, both retained as archival/historical reference, not superseded-in-place.
- These HiveStream docs sign as "Human Project Lead: Elwood Edwards" / "AI: GPT-5.6 Luna (OpenAI)" — a different name than William uses with Claude. Unresolved whether this is an intentional project persona.

---

## 8. Other Confirmed Project Facts (carried forward, still accurate)

- Mobile-only dev workflow: Android + Termux (curl/grep/sed for source analysis, git CLI for commits) + Markor (editing) + jsDelivr (CDN serving into CyTube's external JS/CSS fields). **New this session:** Kiwi Android DevTools is also part of the toolkit for in-browser runtime tests (distinct from Termux) — tests store results in `window.__WSxxx_DATA__` and use a synchronous `copy(JSON.stringify(...))` command, since async clipboard writes are unreliable on that environment.
- CSS injects into CyTube automatically, ungated; JS is gated by `checkScriptAccess()` / localStorage key `channel_js_pref` (WS-030, unchanged).
- `cytube-tanks-script` (BattleTanks) is architecturally unrelated to HiveStream's P2P work: it's a fully deterministic, chat-only MUD-style game with NO server authority and NO peer channel — every client independently simulates fixed-tick state from a shared seed (room name + usernames), using chat messages as the only guaranteed-synchronized input channel. Has its own CI (GitHub Actions: `jsdelivr-purge.yml`, `pastebin-sync.yml`) and multiple parallel LLM-authored implementation branches (Claude, Grok, ChatGPT variants).
- `TEST-ARTIFACT-CREATION-STANDARD.md` codifies the current WS-0xx test methodology: three artifacts per test (`TEST.js` / `TEST-OUTPUT.txt` / `FINDINGS.md`), rich header comments, `window.__WSxxx_DATA__` storage, synchronous clipboard copy.

---

## 9. Recommended Next Steps (not yet actioned)

1. Fill the chat flood/rate-limit knowledge gap — still completely untouched.
2. Close the loader-bootstrap question (HiveStream OQ-001 narrowed form): can HiveStream deliberately trigger the Core/HybridLoader lifecycle from a storage hit alone, without an HTTP-origin download first?
3. Resolve whether CyTube auto-reassigns leadership on disconnect (`autoleadRuntimeBehaviorObserved` still false in WS-073).
4. Add `setPermissions` to the WS-029 outbound event catalog.
5. Optional hygiene (William deferred, not urgent): rename the second WS-073 to WS-074; consolidate the three WS-071 file copies; write FINDINGS.md for WS-071/072/073(x2).
6. Reconcile the William/Elwood-Edwards naming question across future documents.

---

*End of Claude resync memory, 2026-09-08.*
