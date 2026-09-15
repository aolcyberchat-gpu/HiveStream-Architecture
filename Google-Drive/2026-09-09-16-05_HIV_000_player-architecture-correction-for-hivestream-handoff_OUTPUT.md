# HIV-000 — Correction Needed: HiveStream's Assumed Player Chain Doesn't Match Current CyTube Source

**Authors:** Ed (project owner) & Claude (Anthropic)
**Date:** 2026-09-09
**Addressed to:** whoever next revises the HiveStream architecture docs (currently credited to GPT-5.6 Luna / OpenAI in the 2026-09-08 handoff) — flagging this so it gets folded into the next revision rather than silently going stale.
**Source:** WS-077 (`2026-09-09-16-02_WS_077_calzoneman-sync-deep-dive-socketio-player-architecture_OUTPUT.md`), based on a direct read of `calzoneman/sync`'s `player/videojs.coffee`, `player/hls.coffee`, and `player/raw-file.coffee`.

---

## The problem

`HIVESTREAM-P2P-ENGINE-ARCHITECTURE-DECISION-2026-09-08.md` and the accompanying roadmap describe the media pipeline as:

> Video.js → HLS.js 1.x → p2p-media-loader

This assumes an independent HLS.js instance sits between video.js and the P2P engine. **That component doesn't exist in the current CyTube codebase.**

## What's actually there

- CyTube's `HLSPlayer` and `FilePlayer` are both thin subclasses of `VideoJSPlayer`. They don't touch HLS.js at all — they just build a `data.meta.direct` object (a quality-keyed map of `{contentType, link}`) and hand it to video.js via `@player.updateSrc(@sources)`.
- HLS playback is handled entirely inside video.js's own HTTP-streaming support, triggered by the `application/x-mpegURL` content type on the single source `HLSPlayer` provides.
- There is no separate, addressable HLS.js instance anywhere in this chain for p2p-media-loader to attach to as currently drawn.

## What needs to change in the architecture doc

Pick one of two real integration points instead of the assumed one:

1. **Hook video.js's internal HLS handling directly** — video.js's own HTTP-streaming plugin can be intercepted/extended (there's community precedent for wiring p2p-media-loader into video.js this way), keeping CyTube's existing `HLSPlayer` path intact.
2. **Bypass `HLSPlayer` entirely** — register a new custom player type (extending the `base.coffee` `Player` interface directly, not `VideoJSPlayer`) that owns its own HLS.js + p2p-media-loader instance outside of video.js. More engineering work, but avoids fighting video.js's assumptions about source handling.

Either is workable; the current roadmap text just needs to stop assuming a component (a standalone HLS.js instance) that isn't actually there to plug into.

## Also worth carrying forward

The native `'cm'` custom-media-manifest type (`docs/custom-media.md`) is a real, documented extension point for multi-source/quality/audio-track/subtitle metadata — but every source URL must be a public, `https:` reachable address. It cannot host or reference anything served only from a local Service Worker or WebRTC data channel, so it is **not** usable as the P2P segment-delivery path itself. It's only relevant to HiveStream as a possible fallback/seed origin URL, not as the transport.

---

**Action for next session:** fold this correction into `HIVESTREAM-P2P-ENGINE-ARCHITECTURE-DECISION-2026-09-08.md` (or its successor) before further implementation work builds on the incorrect assumed chain.
