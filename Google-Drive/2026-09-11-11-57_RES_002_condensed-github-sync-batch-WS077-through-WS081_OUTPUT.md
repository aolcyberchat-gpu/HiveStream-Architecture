# RES-002 — Condensed GitHub Sync Batch (WS-077 through WS-081, RES-001, HIV-000)

**Authors:** Ed (project owner) & Claude (Anthropic — condensed and prioritized six prior Drive-only findings docs into one pasteable batch)

**Date:** 2026-09-11
**Purpose:** Everything below has been sitting in Google Drive only. If GPT-5.6 Luna or anyone else is actively working on HiveStream Phase 1 right now, none of this has reached them yet — and two items (marked ⚠️) materially affect how Phase 1 work should be approached. Ordered by relevance to Phase 1 first, general knowledge-base closure second. Each section names its suggested destination file so this can be split apart when pasting.

---

## ⚠️ 1. Loader-bootstrap question is CLOSED — affects Phase 1 test design directly

**→ Suggested destination: `duckwerks/HiveStream/docs/PHASE-1-P2P-PROOF.md` (addendum) or `OPEN-QUESTIONS.md` (remove/close the item)**

Source-proven via direct read of `Novage/p2p-media-loader`'s `core.ts` / `hybrid-loader.ts` / `p2p/loaders-container.ts`:

`Core.loadSegment()` creates a live P2PLoader for a stream *before* it checks storage for a hit — loader creation doesn't depend on whether the triggering segment came from HTTP, P2P, or local storage. Once created, the loader announces to peers by freshly querying storage for **every** stored segment ID for that swarm, not just the one requested.

**Practical consequence for Phase 1 test design:** you do not need a special "activate P2P" step to test whether pre-populated/locally-ingested content gets announced. Normal playback start (which always requests segment 0 first) is sufficient to trigger full announcement of everything already in storage — including content that never touched HTTP. If Phase 1's test harness currently assumes some extra activation step is needed for this case, it can be simplified.

## ⚠️ 2. Player architecture correction — affects how the P2P engine gets wired into CyTube

**→ Suggested destination: `duckwerks/HiveStream/ARCHITECTURE.md` and/or `HIVESTREAM-P2P-ENGINE-ARCHITECTURE-DECISION-2026-09-08.md`**

`calzoneman/sync`'s actual current player (`player/videojs.coffee`) is video.js. `HLSPlayer` and `FilePlayer` are both thin subclasses of `VideoJSPlayer` that just populate a quality-keyed source map fed into video.js's own HTTP-streaming handling — **there is no independent HLS.js instance anywhere in the current codebase.**

This means the architecture doc's assumed chain (`Video.js → HLS.js 1.x → p2p-media-loader`) doesn't match what exists. Two real options instead: (a) hook video.js's own internal HLS handling directly, or (b) bypass `HLSPlayer` entirely with a custom player type that owns its own HLS.js + p2p-media-loader instance. This needs to be resolved before CyTube-integration work (Phase 6) gets designed in detail, even though that phase is last — better to fix the assumption now than rediscover it later.

## 3. Segmentation / local ingestion strategy (Phase 4, not urgent yet, but decided)

**→ Suggested destination: `duckwerks/HiveStream/OPEN-QUESTIONS.md` (local ingestion section) and `ROADMAP.md`**

- **Two-tier approach recommended:** MP4Box.js first (GPAC project — repackages an MP4's container into fragmented/segmented form around the *same* encoded bytes, no re-encode, fast even on a phone; only works if the codec is already browser-compatible). Fall back to ffmpeg.wasm only when the source codec/container isn't already compatible.
- **Why segmentation is actually required, not just a preference:** p2p-media-loader needs time-addressable segments + a manifest to register/announce content; a plain progressive MP4 has neither. This is a real requirement of the chosen library.
- **Why it's also strategically valuable beyond that requirement:** deterministic content identity. Two users' independently-sourced copies of "the same" episode won't hash-match as raw files (different container/mux/bitrate), so without some normalization step they'll never converge into the same swarm — which undermines the whole rewatch-bandwidth thesis. A consistent segmentation/identity pipeline is what gives independently-sourced copies a real shot at converging.
- **ffmpeg.wasm performance, confirmed with evidence (not just theoretical WASM overhead):** its own maintainers say to use native FFmpeg if performance is critical. A real-world WebM→MP4 conversion report found throughput *degrading further into longer files* (a 60s clip took over 2x a 30s clip, not just proportionally longer) — directly relevant since target content (TV episodes) runs 20–45 minutes. This slowdown is confined to the one-time conversion job itself; playback afterward is ordinary browser video playback with no relationship to original file size.
- **Deployment constraint:** ffmpeg.wasm's fast multi-threaded mode needs `SharedArrayBuffer`, which needs `Cross-Origin-Embedder-Policy`/`Cross-Origin-Opener-Policy` response headers — not settable on cytu.be's own server. Would need to run in a separate cross-origin-isolated context, mirroring the sandboxed-iframe pattern CyTube itself already uses (`IframeChild`/`/iframe` route).
- **Given most target files were already viewed in-browser before being downloaded**, they're very likely already in a browser-compatible codec — meaning the common case only needs the fast MP4Box.js path, not ffmpeg.wasm at all.

## 4. Metadata strategy (Phase 4, low-risk future layer)

**→ Suggested destination: `duckwerks/HiveStream/OPEN-QUESTIONS.md`**

Don't rely on MP4 `udta`/`moov` metadata surviving segmentation cleanly — keep a JSON sidecar record keyed to the content's deterministic identity (§3) instead, independent of the segments. For enrichment, TMDB's API is the right free option (free for non-commercial use, good TV/season/episode/poster coverage) — better fit than TheTVDB, whose free tier requires each *end user* to hold their own paid $12/yr subscription.

## 5. Tracker scoping recommendation

**→ Suggested destination: `duckwerks/HiveStream/DECISIONS.md`**

Recommend a private/self-hosted WSS tracker over public ones for production. A public/guessable swarm ID means any general WebTorrent/p2p-media-loader client could discover and connect to room members' peers — exposing IPs to people who were never in the CyTube room at all. Same category of concern already confirmed with CyTube's PeerTube-embed privacy warning (§7 below). Public trackers remain fine for prototyping only.

## 6. P2P streaming library survey ("not married to any particular library")

**→ Suggested destination: `duckwerks/HiveStream/DECISIONS.md`**

Independent survey confirms the existing choice holds up: `Novage/p2p-media-loader` is actively maintained (not a single-maintainer curiosity), Apache-2.0, and has an official Android ExoPlayer port — directly relevant given the all-Android dev workflow. `Chocobozzz/p2p-media-loader` is the same lineage (PeerTube's maintainer's involvement), not a competing fork. WebTorrent remains the wrong fit as the *core* transport (not HLS/segment-aware) but is worth keeping as a live option specifically for local-file seeding — `client.seed(file)` needs zero segmentation — if MP4Box.js/ffmpeg.wasm segmentation proves more friction than it's worth for that sub-problem specifically.

## 7. PeerTube embed option — investigated, ruled out as a mechanism

**→ Suggested destination: `duckwerks/cytube-knowledge` as `WS-078-...-FINDINGS.md`; note in HiveStream `OPEN-QUESTIONS.md` local-ingestion section**

CyTube's "Accept PeerTube embeds automatically" is a client-only `localStorage` toggle that skips a privacy warning before iframe-embedding a video already hosted on a curated/allowlisted public PeerTube instance. All P2P activity happens inside that PeerTube instance's own swarm — not scoped to the CyTube room. Not usable as a mechanism for room-scoped local-file sharing. (PeerTube's own transcode/P2P pipeline, separately confirmed via the existing `HIVESTREAM-P2P-MEDIA-LOADER-REUSE-FINDINGS.md` doc already in this repo, remains relevant prior art — it's built on the same `p2p-media-loader` library already chosen.)

## 8. `calzoneman/sync` client-script-relevant surface — now comprehensively covered

**→ Suggested destination: `duckwerks/cytube-knowledge` — new findings files `WS-077` through `WS-081`, plus a `REPO-INDEX.md` refresh**

Closed this pass: Socket.IO server internals (120s ping timeout; per-IP token-bucket rate limit — likely the actual cause of `cytube-ring-plug`'s earlier socket problems; CORS origin-allowlist rejection cause of old 400 responses; cookie-based auth flow with exact hash construction); multi-server discovery (`/socketconfig/<channel>.json`, fully closes prior open questions); the channel module framework and its remaining smaller modules (access control, anonymous-block, drink game, Vimeo link refresher); the complete embed-player family and full media-type registry; the non-leader playback sync algorithm (tolerance thresholds, YouTube/Dailymotion-specific quirks); chat HTML sanitization rules. Explicitly and deliberately left uncovered as out-of-scope for client-script purposes: database/persistence layer, web/ACP HTTP routes, clustering/partition internals, generic util helpers.

## 9. Repo map correction

**→ Suggested destination: `duckwerks/cytube-knowledge`'s `REPO-INDEX.md`**

`duckwerks/HiveStream` is confirmed as the current canonical product repo (superseding the old WebTorrent-based `aolcyberchat-gpu/P2P-Theater-Core` framing entirely). `duckwerks/ai-memory` exists but is still just an empty two-file scaffold — flagged as a plausible candidate for shared cross-LLM memory, but no schema/content established yet; don't assume it's in active use until that's decided.

---

## Suggested paste order

Items 1–2 first (directly affect how Phase 1 should be run/interpreted), then 3–6 (Phase 4 groundwork, useful for whoever picks that up next, not urgent), then 7–9 (general knowledge-base closure, no urgency).
