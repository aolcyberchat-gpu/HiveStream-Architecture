# WS-082 — Resync With cytube-knowledge, WebRTC/STUN/ICE/TURN/WebTorrent File Review, and Phase-1 Script Verification

**Authors:** Ed (project owner) & Claude (Anthropic — pulled `duckwerks/cytube-knowledge`, read the WebRTC/network-testing files and three HiveStream architecture checkpoints already in it, then independently verified the pasted `phase-1-p2p-proof.html` against a fresh clone of `Novage/p2p-media-loader` v4.0.0 source)

**Date:** 2026-09-14

---

## 1. Headline finding: the deep dive requested has largely already been done, and done well

Before doing new research, `cytube-knowledge` was pulled fresh. It had grown by five substantial documents since the last sync: `WEBRTC-NETWORK-TESTING-KNOWLEDGE.md`, three dated HiveStream architecture checkpoints (2026-09-07, 2026-09-08 ×2), and — most recently — `HIVESTREAM-P2P-ARCHITECTURE-RESEARCH-CHECKPOINT-2026-09-13.md`, dated the day before this session. Together these already constitute exactly the "deep dive on WebRTC/HLS/PeerTube/P2P streaming/browser storage/IndexedDB" requested — done thoroughly, with real external citations (PeerTube's own architecture docs, Novage's versioned release notes and migration guide, the current IETF HLS 2nd-edition draft, W3C MSE Level 2, MDN OPFS/StorageManager/WebTransport pages, the IETF MOQT draft family). Re-doing that research from scratch would be redundant. Summarized below, with emphasis on what's new or changed since the last resync, plus the concrete new verification work this pass actually added.

## 2. WebRTC / STUN / ICE / TURN files — what they actually show

`WEBRTC-NETWORK-TESTING-KNOWLEDGE.md` consolidates five April-2026 network experiments plus a large WebTorrent instrumentation log, with careful separation between raw observation and architectural conclusion:

- **Forced-relay TURN testing failed in all four tested network/VPN combinations** (mobile data, Wi-Fi/DSL, each with and without VPN), using `iceTransportPolicy: "relay"` against Google STUN + `openrelay.metered.ca` TURN. The logs are diagnostically weak (`ICE: {}` / `ICE STATE: failed` with no candidate-pair detail), so this is recorded as a valid negative result for that *specific* TURN configuration, not proof that TURN or any mobile network is broken in general.
- **A separate, larger WebTorrent.io instrumentation test showed the opposite outcome for direct/STUN-assisted connectivity**: real `RTCPeerConnection` creation, host and server-reflexive ICE candidates, ICE/connection state reaching `connected`, active WebRTC DataChannels, and — most convincingly — a captured binary payload beginning with the literal BitTorrent protocol handshake string, sent over an established DataChannel. No relay candidate appears anywhere in the inspected portion, so TURN is explicitly *not* credited for that success.
- **The document's own discipline is worth adopting elsewhere**: it introduces an evidence-tier system (raw observation → repeated observation → controlled conclusion → architecture-level conclusion) specifically to prevent one browser experiment from silently becoming treated as a universal law — and it's honest that the WebTorrent artifact (~254KB) was only partially inspectable through the tools available at the time, so several follow-up questions (which candidate pair actually won, whether real piece data crossed the channel vs. just the handshake) are explicitly marked unresolved rather than guessed at.
- **Bottom line already reached**: direct/STUN-assisted WebRTC is demonstrated working in the tested environment; the specific TURN relay configuration tested is not; TURN should remain a fallback capability, not a prerequisite, and the next useful network test is `getStats()`-based candidate-pair forensics, not another blunt TURN pass/fail tester.

## 3. HiveStream architecture checkpoints — condensed status

Three checkpoints in `cytube-knowledge` (2026-09-07, two dated 2026-09-08, and the 2026-09-13 one) collectively move the project from "is browser P2P video possible" to "how do we add persistent, room-coordinated replication on top of an already-proven stack." Key points, condensed:

- **This directly resolves the open question flagged in `HIV-000` (the video.js/HLS.js correction sent to the HiveStream handoff on 2026-09-09).** The 2026-09-07 checkpoint independently found and confirmed the same thing from the other direction — CyTube's HLS playback already goes through a *replaceable Video.js Source Handler* (`www/js/vjs/videojs-hlsjs-plugin.js`, an old Streamroot HLS.js 0.13.2 integration) rather than a hardcoded path. That means option (a) from the earlier correction — hook the existing seam rather than bypass CyTube's player entirely — is not just possible but is already the specific, source-confirmed integration point: swap the old Streamroot source handler for one wrapping HLS.js 1.x + `HlsJsP2PEngine`, and CyTube's playlist/control code never needs to change at all. This closes that open item cleanly.
- **The P2P Media Loader library itself has moved fast in 2026** and the checkpoint tracks the parts that matter: v2.3.0 (May 2026) changed how tracker infohash is derived per-stream-quality (a breaking change for cross-version peer visibility); v3.0.0 (June 2026) added a browser-native WebTorrent implementation plus real peer-management knobs (max peers, churn cleanup, WebRTC offer/ICE-gathering/connection timeouts); the v3→v4 migration moved stream-identity derivation into the library's core itself, which is exactly the seam HiveStream needs for its own planned media-identity layer.
- **PeerTube is treated as production validation, correctly scoped**: it proves the HLS + hls.js + p2p-media-loader + WebRTC + HTTP-fallback architecture is real and shipping, not a lab toy — but it does *not* prove HiveStream's actual differentiator (room/playlist-aware persistent replication), which remains genuinely unsolved and is correctly identified as the real engineering opportunity.
- **Storage direction**: IndexedDB for metadata/catalog, OPFS as a candidate for the large binary segment payloads themselves (flagged as a hypothesis to benchmark, not a final decision — OPFS is genuinely capable but still subject to the same origin-quota and eviction constraints as everything else).
- **Explicitly deferred, in the project's own words**: further carrier/NAT/TURN permutation testing, replacing WebRTC over one Android failure, custom signaling/transport, adopting WebTransport or MOQT before they stabilize, and replacing p2p-media-loader with libp2p. None of these are considered prerequisites for a desktop-first Phase 1.
- **Revised Phase 1 plan** now has explicit sub-phases: 1A (pin exact dependency versions, stop using `@latest`), 1B (real two-desktop-peer P2P proof, measuring actual bytes not just signaling), 1C (persistence proof — a peer that reloads still serves previously-downloaded segments), 1D (playlist-aware prefetch), 1E (desktop persistent seeder via Tauri/Electron). The pasted script represents 1B.

## 4. New this pass: the pasted `phase-1-p2p-proof.html` was verified line-by-line against real v4.0.0 source

This is the concrete new work this pass adds rather than just re-summarizing existing research. Cloned `Novage/p2p-media-loader` fresh and confirmed the checked-out source is exactly v4.0.0 for both `p2p-media-loader-core` and `p2p-media-loader-hlsjs` (matching the pinned versions in the script — good, since the 2026-09-13 checkpoint specifically flagged `@latest` CDN pins as no longer acceptable, and this script already does the right thing by pinning exact versions).

Checked every event name and callback signature the script relies on against the actual TypeScript source:

- `HlsJsP2PEngine.injectMixin(Hls)`, the `onHlsJsCreated` callback, and `p2p.core.swarmId` config option all match the real integration surface exactly.
- `onChunkDownloaded(bytesLength, downloadSource, peerId, streamType, infoHash)` and `onChunkUploaded(bytesLength, peerId, streamType, infoHash)` — both confirmed as exact positional-parameter matches against the library's own type definitions (the source comments explain these are positional rather than object-based specifically to avoid allocation overhead on a high-frequency event).
- Every other event the script listens for (`onStreamAdded`, `onStreamRegistrationError`, `onPeerConnect`, `onPeerClose`, `onPeerError`, `onPeerConnectError`, `onSegmentStart`, `onSegmentLoaded`, `onSegmentAbort`, `onSegmentError`, `onTrackerError`, `onTrackerWarning`) and the `Stream` object fields it reads (`runtimeId`, `type`, `properties`, `swarmId`, `identityHash`, `streamSwarmId`, `infoHash`) all match the real source exactly.

**Result: no bugs found. The script's library usage is accurate against real v4.0.0 source, not just plausible-looking.** One minor, non-blocking observation: `DownloadSource` is actually a two-value literal type (`"http" | "p2p"` — nothing else), so the script's defensive substring-matching (`.includes("peer")`, `.includes("server")`, etc.) is more permissive than the type ever requires. Harmless, just unnecessary — not worth changing before running the test.

**One genuinely useful detail surfaced by this verification, worth carrying into HiveStream's own media-identity design:** the exact formula the library uses for `streamSwarmId` is source-confirmed as `${peerProtocolVersion}-${swarmId}-${type}-${identityHash}`, with `infoHash` being a 20-character hash derived from that. That's the precise seam the Sept-13 checkpoint's proposed "HiveStream Media Identity → streamSwarmId → infoHash" layering needs to hook into.

## 5. Verdict on the "should we run this test" question

Nothing found in this pass gives a reason to delay running the pasted script. The library versions are pinned correctly, the API usage is verified correct against real source, and the test's own success criteria (actual `p2p` bytes via `onChunkDownloaded`, not just a peer connection) match exactly what the project's own evidence discipline calls for. This is a good-faith, correctly-built Phase 1B proof — the honest next step is running it on two desktop browsers, not further research.

---

## Memory system correction (housekeeping, not architecture)

Discovered this session that a tool this assistant had been calling in earlier turns of this conversation to "update memory" does not actually exist in the real toolset — none of those updates ever persisted. Real persistent memory has now been set up correctly for this project going forward; nothing about the Drive files or the GitHub repos themselves was affected by this, only this assistant's own note-taking between sessions. Flagging for transparency rather than letting it go unmentioned.
