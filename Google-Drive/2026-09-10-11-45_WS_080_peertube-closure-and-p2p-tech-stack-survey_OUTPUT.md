# WS-080 — PeerTube Closure + Survey of Pre-existing P2P Streaming & Local-Ingestion Tech Stacks

**Authors:** Ed (project owner) & Claude (Anthropic — cross-referenced against `duckwerks/cytube-knowledge`'s existing `HIVESTREAM-P2P-MEDIA-LOADER-REUSE-FINDINGS.md`, then researched the current library landscape via web search)

**Date:** 2026-09-10

---

## Part 1 — The PeerTube question is already closed from both sides; here's the combined answer

This exact question has now effectively been investigated twice, from two complementary angles, and both are already sitting in the knowledge base:

- **CyTube's side (WS-078, this repo, 2026-09-09):** "Accept PeerTube embeds automatically" is just a client-side toggle that skips a warning dialog before iframe-embedding a video hosted on a known public PeerTube instance. CyTube itself does none of the P2P work — it just displays PeerTube's own embed player.
- **PeerTube's side (`HIVESTREAM-P2P-MEDIA-LOADER-REUSE-FINDINGS.md`, already in this repo, dated 2026-09-07):** a much deeper investigation already exists here, done directly against PeerTube's own source. It confirms PeerTube integrates `Novage/p2p-media-loader` into its HLS player stack, supplying tracker URLs, STUN/WebRTC config, and segment validation — i.e. PeerTube is a real, production example of exactly the "HLS playback plus P2P segment distribution" architecture HiveStream wants to build.

**Combined conclusion:** the CyTube embed *feature* isn't usable as a mechanism (confirmed), but PeerTube's own *implementation* is directly relevant as prior art, and — importantly — it's not just "prior art to study," it's literally built on the same library HiveStream already chose. That's a stronger validation of the p2p-media-loader decision than either document alone showed.

---

## Part 2 — P2P streaming library survey ("not married to any particular library")

Since you're not committed to a specific library, here's an honest look at what else exists, not just a defense of the existing choice.

### Novage/p2p-media-loader — remains the strongest fit, now with more confidence

A few things worth knowing that weren't previously established:

- **It's actively maintained**, not an abandoned or single-maintainer curiosity — it has recent releases, ongoing dependency/security updates, and there's even an official **Android ExoPlayer port** (`Novage/p2p-media-loader-mobile`), which matters directly given your all-Android workflow.
- **License: Apache-2.0** — permissive, no copyleft concerns for a project like this.
- There's a `Chocobozzz/p2p-media-loader` entry on GitHub too — this is not a competing fork with diverging goals, it's PeerTube's own maintainer's involvement with the same upstream project (he's filed issues/PRs against it going back to 2018). One continuous lineage, not a fragmented ecosystem — worth not being confused by seeing two names.
- Built-in player integrations exist for both Hls.js and Shaka Player, and works with common video-player UIs (Vidstack, Clappr, Plyr, DPlayer, etc.) if HiveStream ever wants a pre-built player shell rather than hooking video.js directly.

### WebTorrent — the library that was explicitly ruled out, worth a second look for one specific sub-problem

WebTorrent is far more mature and battle-tested than any HLS-P2P library for exactly one thing HiveStream needs eventually: **taking an arbitrary local file a user has and making it P2P-shareable with zero server involvement.** In-browser, `client.seed(file)` on a `File` object (e.g. from a file input) produces a shareable torrent immediately — no segmentation, no manifest, no transcoding step required first. That's a meaningfully simpler local-ingestion path than what p2p-media-loader requires (see Part 3).

The reason it was ruled out as the *core* engine still holds: WebTorrent is file/piece-oriented, not HLS-segment/manifest-aware, so it doesn't naturally support "start playing immediately while adaptive-bitrate segments stream in" the way p2p-media-loader does. But worth being precise about what was actually rejected: it was WebTorrent as the **primary streaming transport**, not necessarily WebTorrent as *a* tool anywhere in the system. Since p2p-media-loader's own signaling is itself WebTorrent-tracker-compatible (both libraries talk to the same kind of tracker infrastructure), there isn't a hard technical wall between "use p2p-media-loader for streaming" and "also use WebTorrent specifically for the local-ingestion/seeding sub-problem" if that turns out to be the simpler path when Part 3's segmentation questions get worked through. Worth flagging as a live option rather than a closed door, especially if MP4Box.js/ffmpeg.wasm segmentation turns out to be more friction than it's worth.

### CDNBye's `hlsjs-p2p-engine` — a real alternative, but different in character

Functionally similar to p2p-media-loader (WebRTC data channels, bittorrent-like protocol, hls.js/video.js/JWPlayer compatible), but reads as a more commercially-oriented product (CDNBye positions itself as a paid eCDN service) rather than a community open-source project built by/for exactly your use case the way p2p-media-loader is. Worth knowing it exists as a point of comparison, not a strong recommendation over p2p-media-loader for a personal project.

### A couple of things to explicitly avoid

- **`webp2p-hls` / "free CDN" style wrapper services** turned up in search results advertising themselves as a drop-in `<script>` tag pointing at someone else's hosted infrastructure. This is the opposite of what you want architecturally (introduces a third party's server as a dependency) and has none of the transparency/control your project is built around — not worth further investigation.
- **Fizik0/p2p-streaming** appears to be a rebrand/redistribution of p2p-media-loader itself (identical description text) rather than a distinct project — worth not treating it as a separate option to evaluate.

### Recommendation

No change to the existing p2p-media-loader decision — it holds up well under independent scrutiny, is actively maintained, has a mobile-relevant integration path, and is literally validated in production by PeerTube. The one adjustment worth making: don't treat "no WebTorrent" as an absolute rule going into the local-ingestion phase — revisit it specifically if MP4Box.js/ffmpeg.wasm segmentation (below) proves painful.

---

## Part 3 — Local media ingestion / browser-side segmentation survey

This is the still-open problem `HIVESTREAM-P2P-MEDIA-LOADER-REUSE-FINDINGS.md` explicitly flags as the next hard boundary (its §13). Three real options exist, each with a different tradeoff:

### MP4Box.js (GPAC project) — the lightweight, no-transcode path

Purpose-built for exactly one relevant job: taking an already-encoded MP4 file and **repackaging it into fragmented/segmented MP4 for Media Source Extensions** — it does not touch the actual video/audio bitstream, just restructures the container into segments. This means:
- **Fast** — no re-encoding, so it's realistically usable on a phone.
- **Limited** — only works if the source file's codec is already browser-playable (typically H.264/AAC in an MP4 container). A user's `.mkv` with an incompatible codec, or a non-MP4 container, won't work through this path alone.
- Mature, widely used (it's the reference implementation the GPAC project ships, and other tools like dash.js/Shaka build on similar GPAC tooling).

**This is the realistic default path** for the common case (most user-recorded/downloaded video is already H.264 MP4) — get segments into a p2p-media-loader-compatible form with the least engineering effort and the least phone CPU load.

### ffmpeg.wasm — the heavy, does-everything fallback

A full WebAssembly port of FFmpeg, MIT-licensed, actively maintained. Can transcode essentially anything (arbitrary codec/container in, MP4/WebM out) directly in the browser. The real-world catch, worth flagging clearly because it directly affects how this would have to be deployed: **its full-speed (multi-threaded) mode requires `SharedArrayBuffer`, which requires the page to send `Cross-Origin-Embedder-Policy: require-corp` and `Cross-Origin-Opener-Policy: same-origin` HTTP headers.** As a script injected into cytu.be's existing page, HiveStream has no ability to set those headers on CyTube's own server. Two ways around it if ffmpeg.wasm is needed:
1. Run in single-threaded mode (works without those headers, but meaningfully slower — a real concern on a phone).
2. Do the heavy transcoding in a separate, cross-origin-isolated page/worker context you *do* control (your own small hosted page, opened via popup/iframe, that has the right headers), then hand the finished segments back to the CyTube tab. This mirrors the pattern already found in `calzoneman/sync` itself — the `/iframe` sandboxed child-player route (`IframeChild`, WS-079) is exactly this "do the real work in an isolated context, communicate back" pattern, just for a different purpose.

**Realistic role:** the fallback path for files MP4Box.js can't handle as-is (wrong codec/container), not the default path for every upload.

### WebCodecs — worth knowing about, not a full solution by itself

A lower-level browser API (raw hardware-accelerated encode/decode access, no container/muxing logic at all) that reached broad **Baseline support (Chrome/Edge/Firefox/Safari) only as of March 2026** — genuinely new, not a long-established option. Chromium (and therefore Kiwi Browser) has actually had it since 2022, so it's usable in your dev environment specifically. It's not a replacement for MP4Box.js or ffmpeg.wasm on its own — it gives you frame-level encode/decode, but you'd still need to pair it with a separate muxer (e.g. a lightweight library like `mp4-muxer`) to actually produce playable segments. Worth keeping on the radar as a future, more efficient alternative to ffmpeg.wasm for the transcode fallback case, but not mature/simple enough yet to lead with.

### Recommendation

A two-tier approach: **try MP4Box.js first** (fast, no transcode, handles the common case), and **fall back to ffmpeg.wasm in an isolated context** only when the source file's codec/container isn't already compatible. This avoids paying ffmpeg.wasm's performance and deployment-complexity cost for the majority of files, while still covering the general case.

---

## Summary table

| Layer | Recommended | Why | Real alternative worth keeping in mind |
|---|---|---|---|
| P2P streaming transport | Novage p2p-media-loader | Actively maintained, Apache-2.0, mobile port exists, literally what PeerTube runs in production | WebTorrent, specifically for local-file seeding if segmentation proves painful |
| Local file → segments (common case) | MP4Box.js | Fast, no transcode, phone-friendly | — |
| Local file → segments (incompatible codec) | ffmpeg.wasm, isolated context | Handles arbitrary input | WebCodecs + a muxer, once more tooling matures |

## Suggested next action

This resolves the "which libraries" question cleanly enough that the next real blocker is still what `HIVESTREAM-P2P-MEDIA-LOADER-REUSE-FINDINGS.md` already identified: closing the **loader-bootstrap question** (can a pre-populated storage hit activate a P2PLoader and get announced to peers without an HTTP download first) — that's still open and still gates everything in Part 3 from mattering. Worth prioritizing a focused source read of `p2p-media-loader-core`'s `initializeSegmentStorage()`/`Core.loadSegment()` path before spending more effort on segmentation tooling.
