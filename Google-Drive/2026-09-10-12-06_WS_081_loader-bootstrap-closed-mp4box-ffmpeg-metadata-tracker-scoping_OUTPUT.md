# WS-081 — Loader-Bootstrap Question CLOSED, MP4Box.js Deep Dive, ffmpeg.wasm Real-World Speed, Metadata Strategy, Tracker Scoping

**Authors:** Ed (project owner) & Claude (Anthropic — direct source read of `Novage/p2p-media-loader`'s `core.ts`, `hybrid-loader.ts`, and `p2p/loaders-container.ts`; web research on ffmpeg.wasm real-world performance and TMDB API terms)

**Date:** 2026-09-10

---

## 1. The loader-bootstrap question is now CLOSED (SOURCE PROVEN)

This was the open question `HIVESTREAM-P2P-MEDIA-LOADER-REUSE-FINDINGS.md` flagged as the next hard boundary: *can a pre-populated storage hit activate a P2PLoader and get announced to peers without requiring an HTTP download first?*

**Answer: yes, definitively, and the mechanism is simpler than it looked.**

Tracing the actual call chain in `p2p-media-loader-core/src/core.ts`, `hybrid-loader.ts`, and `p2p/loaders-container.ts`:

1. `Core.loadSegment()` is the only entry point that ever creates a P2P loader for a stream. It's called by the player-integration adapter (hls.js/Shaka engine) whenever the player wants a segment — including the very first segment at the start of playback.
2. Inside `HybridLoader.loadSegment()`, **before** it checks storage for a hit, it unconditionally calls `this.p2pLoaders.changeCurrentLoader(stream)` whenever the requested segment belongs to a stream that doesn't already have an active loader.
3. `P2PLoadersContainer`'s constructor (and `changeCurrentLoader`'s internal `#findOrCreateLoaderForStream`) creates a live `P2PLoader` for that stream immediately, synchronously, with no dependency on whether the segment that triggered it came from HTTP, P2P, or local storage.
4. Only *after* that loader-creation step does `HybridLoader.loadSegment()` check `segmentStorage.hasSegment()` / `getSegmentData()` — and if the segment is already in storage, it resolves instantly with zero network I/O.
5. Once a `P2PLoader` exists for a stream, its outbound segment announcement (`p2p/loader.ts`) is built by calling `segmentStorage.getStoredSegmentIds(swarmId, streamSwarmId)` — which returns **every** currently-stored segment ID for that swarm, not just the one that triggered loader creation.

**Practical consequence:** you don't need any special "activate P2P for this locally-ingested content" call. The instant playback of a locally-stored stream begins — which happens naturally the moment a user selects it, since the player always requests segment 0 first — that single `loadSegment()` call (which resolves instantly from storage, no HTTP) is sufficient to spin up a live P2PLoader, and that loader immediately announces the *entire* set of already-stored segments for that swarm, including ones that were locally ingested and never touched HTTP at all. The bootstrap is essentially free — it rides on the normal playback-start segment request.

One adjacent detail worth noting: `initializeSegmentStorage()` wires up the storage-change callback (`setSegmentChangeCallback`) *after* your custom storage's own `initialize()` resolves, so there's no race condition risk if a custom `SegmentStorage` implementation pre-populates its known segment IDs synchronously during `initialize()` — nothing can fire a missed callback before the listener is attached.

This resolves the last open architectural blocker from the reuse-findings doc. The remaining work in that area is genuinely just implementation (writing a `SegmentStorage` that persists to IndexedDB and correctly reports pre-existing content), not further architecture research.

---

## 2. MP4Box.js, elaborated

MP4Box.js (from the GPAC project, same lineage as the reference `MP4Box` CLI tool) does exactly one job: **it re-packages an already-encoded MP4 file's container structure, without touching the compressed video/audio bitstream at all.**

Concretely: a normal "progressive" MP4 has one big, contiguous `mdat` (media data) box with a single `moov` (movie metadata/index) box describing where every sample lives. MP4Box.js's segmentation mode rewrites that into a series of `moof`+`mdat` fragment pairs (fragmented MP4, "fMP4") — the same fragment structure HLS/DASH segments use — each one independently requestable and playable via `SourceBuffer.appendBuffer()` in Media Source Extensions. It walks the existing sample table, decides fragment boundaries (by sample count or by keyframe/RAP alignment, both configurable), and writes new fragment headers around the *same underlying encoded bytes*. No decode step, no re-encode step, no quality loss, no re-computation of pixels — it's closer to "reslicing a file" than "converting" it in the way a transcode is.

This is why it's fast: on a phone, resegmenting a typical episode-length H.264/AAC MP4 is realistically a few seconds of CPU work, not minutes.

**The hard boundary:** it can only work with codecs the browser can already decode. If the source is H.264 video + AAC audio in an MP4 container (extremely common for anything downloaded from a mainstream site), MP4Box.js's segmentation mode is directly usable. If it's something like an MKV container, a codec such as H.265/HEVC without browser decode support, or certain older/unusual codecs, it can't fix that — that's exactly the case ffmpeg.wasm exists for.

---

## 3. "The files already play in-browser and on CyTube already — why convert them at all?"

This is the right question to ask, and the honest answer has two different parts depending on which piece of the architecture you mean.

**"Does it need to be touched to just play back locally?"** — No. Any file that plays via a normal `<video>` tag already works exactly as-is with zero processing. Playability was never the reason to touch the file.

**"Does it need to be touched to be P2P-shareable through p2p-media-loader specifically?"** — Yes, and this is the real reason. p2p-media-loader's entire model is built around **time-addressable segments described by a manifest** (HLS `.m3u8` / DASH `.mpd`) — its `Core` registers `Segment` records with start/end times and external IDs, and peers request/announce by segment ID, not by arbitrary byte ranges of a monolithic file. A plain progressive MP4 has no such segment/manifest structure at all — there's nothing for p2p-media-loader to register or for a peer to request as a discrete, resumable, independently-cacheable unit. **This is a real architectural requirement of the chosen library, not an arbitrary preference** — segmenting is the price of entry for using p2p-media-loader on a file that didn't already come from an HLS/DASH source.

**The alternative, worth naming explicitly:** this is exactly the scenario where WebTorrent-style piece-based sharing (flagged as worth reconsidering in WS-080) sidesteps the problem entirely — WebTorrent shares arbitrary byte ranges of a file as-is, no segmentation or manifest needed, and can still support progressive in-browser playback via sequential piece-priority downloading. If HiveStream ever wants to avoid the segmentation step altogether for locally-ingested files specifically, that's the path — at the cost of not fitting into the same unified stream/segment/storage model as everything else, meaning it would be a second, separate mechanism rather than reusing the same P2PLoader machinery documented in §1.

**Is there a longer-term advantage to converting anyway, beyond just "it's required for p2p-media-loader"?** Yes, and it's a real one, tied directly to your rewatch-bandwidth thesis: **deterministic content identity across different original sources.** If User A downloads a copy of an episode from one site and User B downloads a differently-encoded rip of nominally "the same" episode, raw whole-file hashing (which is what WebTorrent-style piece hashing effectively does) will almost certainly **not** recognize them as the same content — different container, different mux order, different bitrate, even a different timestamp in the file header changes the hash completely, so the two would end up in two unrelated swarms with zero shared pieces. A normalization step (even just consistent segmentation boundaries and a canonical identity derived from content rather than raw bytes) is what gives you a realistic shot at two different users' independently-sourced copies of the same episode converging into the *same* swarm — which is the whole point of the "channels that replay the same series over and over" thesis. Raw, unprocessed files from arbitrary internet sources will not naturally converge on their own.

---

## 4. Metadata: preserve it, and consider enriching it — reasonable scope, not a distraction

**Preservation:** Don't rely on MP4 container-level metadata (the `udta`/`meta` atoms that can hold a title, description, or cover art inside `moov`) surviving the segmentation step cleanly for identification purposes — once a file is fragmented into `moof`/`mdat` pairs for streaming, the natural place for descriptive metadata is the *outer* layer (the manifest or an accompanying record), not something buried per-fragment. The practical approach: before or during segmentation, read whatever metadata the original file already has (title, description, embedded cover art if present) and store it as a small JSON sidecar record keyed to the content's deterministic identity from §3 — independent of the segments themselves, and untouched by whatever happens to the video bytes.

**Enrichment:** appending real metadata from a free service is a reasonable, low-risk, low-scope addition once identity exists — it's a separate lookup step, not something that touches the P2P mechanics at all. **The Movie Database (TMDB) API** is the right fit here: free for non-commercial use (a written commercial agreement is only required above certain usage/revenue thresholds that don't apply to a personal project), covers TV series/season/episode metadata (including posters) in real depth — good specifically for a "channel replays American Dad" use case — and just needs a free API key. (TheTVDB is the other well-known option but is subscriber-funded — end users need their own $12/year TheTVDB subscription for free access — which is a worse fit than TMDB for this.) This is reasonable to plan for, not out of scope, but it's correctly a later/optional layer: nothing about P2P distribution depends on it.

---

## 5. ffmpeg.wasm real-world speed — confirmed noticeably slower, not just theoretically

Went looking specifically for real-world numbers rather than just "WASM has overhead" generalities. Findings:

- **The project's own maintainers are direct about this**: in a discussion about compressing a large video in-browser, the response from an ffmpeg.wasm-adjacent maintainer was blunt — *"the WebAssembly version is doomed to be slower than native version due to many aspects... I would recommend you to use native version if performance is critical to you."* That's not a caveat buried in docs, it's the project's own honest framing.
- **A concrete, relevant real-world report**: someone using ffmpeg.wasm to convert screen recordings from WebM to MP4 (a comparable workload — mainstream codec to mainstream codec) found performance **degrades as the file gets longer**, not just linearly slower — a 60-second clip took more than twice as long as a 30-second clip, and throughput visibly dropped over the course of a single conversion. This matters directly for your use case: TV episodes are 20–45 minutes, not short clips, so this degradation pattern (not just a flat "2-3x slower than native" multiplier) is the more relevant number to plan around.
- Multi-threaded mode (the fast path) is meaningfully faster than the single-threaded fallback (one comparison found roughly 2x), but is exactly the mode gated behind the `SharedArrayBuffer`/cross-origin-isolation headers already flagged in WS-080 as something you can't set on cytu.be's own server.

**Bottom line: yes, noticeably slower, even on modern hardware, and the gap is real enough that the project's own team recommends against it when performance matters.** This reinforces the two-tier recommendation from WS-080 rather than changing it: MP4Box.js as the default (no re-encode, so this slowdown doesn't apply at all), ffmpeg.wasm reserved specifically for the minority of files where segmentation-without-transcoding genuinely isn't an option.

---

## 6. Pros/cons: converting local files into a standardized P2P-ready format

**Pros**
- Required to participate in the same unified p2p-media-loader stream/segment/storage model as everything else (§3) — one mechanism, not two parallel systems.
- Enables deterministic content identity across independently-sourced copies of the same episode (§3) — directly serves the rewatch-bandwidth thesis.
- Enables partial/resumable sharing — a peer can request just the segments they're missing, not the whole file.
- A natural place to attach preserved/enriched metadata (§4) via a sidecar record tied to that same deterministic identity.

**Cons**
- Real CPU/time cost on a phone, especially in the ffmpeg.wasm fallback case (§5).
- MP4Box.js's no-transcode path only covers already-browser-compatible codecs; anything else needs the much heavier fallback.
- Adds a processing step (and associated code/complexity) between "user selects a file" and "content is shareable," where WebTorrent-style raw sharing would have none.
- If deterministic identity generation isn't done carefully, you can end up with the worst of both worlds: processing overhead paid, but still no actual convergence between different users' copies.

---

## 7. Publishing to a public WSS/WebTorrent tracker — technical yes, scope question no

(Reading "wws tracker" as WSS tracker — the WebSocket-Secure signaling servers p2p-media-loader and WebTorrent both use.)

**Technically:** p2p-media-loader already requires a WSS tracker for its own peer-discovery signaling — this isn't optional, it's how peers find each other at all (confirmed in WS-080: it defaults to public trackers like `wss://tracker.novage.com.ua`). So the question isn't really "should we use one," it's "which one, and how broadly should it be scoped."

**The actual choice that matters:** a *public* tracker (the free, shared ones anyone's WebTorrent/p2p-media-loader client can use) vs. a **private/self-hosted tracker** (`wt-tracker`, `bittorrent-tracker`, etc. — both already noted as options in WS-080) that only your own HiveStream clients know about or are permitted to use.

Using a public tracker has a real, concrete downside worth being explicit about, and it's the same category of concern already surfaced in WS-078's PeerTube privacy-warning finding: **the swarm ID is effectively public, so any general WebTorrent/p2p-media-loader client that happens to compute or guess the same swarm ID could discover and connect to your peers** — meaning room members' IP addresses could become visible to people who were never in that CyTube room at all, and the swarm isn't meaningfully "yours" anymore. A self-hosted (or small-scale, access-controlled) tracker keeps the peer set scoped to people who actually have your client/room, which matches both the privacy expectation of a CyTube room and the actual goal (offloading server bandwidth within your own audience, not building a public P2PTV network). Given HiveStream's stated priorities don't include "publicly distribute content to strangers," a private tracker is the better default — public trackers are more of a fast/free prototyping convenience (mentioned in the p2p-media-loader docs themselves as fine for initial development, not recommended for production) than something worth keeping long-term.

---

## Summary of what changed this pass

- **Closed**: the loader-bootstrap question — no longer open, source-proven with an exact call chain.
- **Clarified**: MP4Box.js is a repackaging tool, not a transcoder — which is exactly why it's fast and why it has hard limits.
- **Answered**: yes, there's a real architectural reason to convert even already-playable files (segment/manifest requirement) and a real strategic reason beyond that (deterministic identity across sources).
- **Confirmed with evidence**: ffmpeg.wasm's slowness is not just theoretical WASM overhead — it's acknowledged by its own maintainers and gets worse on longer files, which is directly relevant to TV-episode-length content.
- **Scoped**: metadata enrichment via TMDB is reasonable, low-risk, and correctly a later/optional layer.
- **Recommended**: private/self-hosted tracker over public ones, for the same privacy/scope reasons already surfaced with PeerTube.
