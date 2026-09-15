# WS-078 — CyTube "Accept PeerTube Embeds Automatically" Option: What It Actually Does

**Authors:** Ed (project owner) & Claude (Anthropic — read `player/peertube.coffee`, `src/get-info.js`, `src/peertubelist.js`, `www/js/data.js`, `www/js/util.js`, `templates/useroptions.pug` from `calzoneman/sync`)

**Date:** 2026-09-09
**Trigger:** Ed asked whether Menu → Options → Playback → "Accept PeerTube embeds automatically" is relevant to HiveStream's P2P/local-ingestion goals.

## Short answer

**It isn't a general P2P mechanism CyTube provides, and it can't be used to P2P-share a locally uploaded file with a room.** It's a one-checkbox toggle that skips a privacy-warning dialog before embedding a video that's already hosted on a *known public PeerTube instance*. The actual P2P activity happens entirely inside PeerTube's own embedded player, scoped to that PeerTube instance's own swarm — not to the CyTube room.

## Full technical trace

**The option itself** (`templates/useroptions.pug` line 89, `#us-peertube` checkbox) maps directly to a client-only, `localStorage`-backed flag:
```
www/js/data.js:180   peertube_risk : getOrDefault("peertube_risk", false)
www/js/util.js:656   $("#us-peertube").prop("checked", USEROPTS.peertube_risk);
www/js/util.js:693   USEROPTS.peertube_risk = $("#us-peertube").prop("checked");
```
Nothing about it is synced to the server or to other users — it only controls whether *your own browser* shows a one-time-per-session warning dialog before loading a PeerTube embed.

**The media type is `pt`.** Server-side, adding a PeerTube link runs through `src/get-info.js`'s `pt` handler, which calls `PeerTube.lookup(id)` from the external `@cytube/mediaquery` package. That package (and `src/peertubelist.js`, which refreshes a `peertube-hosts.json` allowlist once a day via `fetchPeertubeDomains()`) means **only videos on a curated/known list of public PeerTube instances can be added as `pt` media** — there's no way to point this at an arbitrary self-hosted instance or a raw uploaded file that isn't already an existing PeerTube video with a real domain+UUID.

**Playback is a plain iframe embed of the origin site's own embed player**, not anything CyTube renders itself:
```coffee
video.attr(src: "https://#{data.meta.embed.domain}/videos/embed/#{data.meta.embed.uuid}?api=1")
@peertube = new PeerTubePlayer(video[0])
```
`PeerTubePlayer` is PeerTube's own official postMessage-based embed control API. CyTube just calls `.play()`, `.pause()`, `.seek()`, `.getVolume()` etc. on it and listens for `playbackStatusChange`/`playbackStatusUpdate` events to drive the room's leader-sync (`sendVideoUpdate()`, `socket.emit('playNext')`) — the exact same leader pattern confirmed for every other player type in WS-067/WS-077.

**The privacy warning text itself confirms the scope**: it tells the user that *"PeerTube instances may use P2P technology that will expose your IP address to third parties, including but not limited to other users in this channel"* — i.e. the warning is about joining that PeerTube instance's own WebRTC/WebTorrent swarm (which may include random internet viewers of that video, not just CyTube room members), not about CyTube brokering P2P between room viewers itself.

## What this means for HiveStream

- **Not usable as-is** for HiveStream's Phase 4 (local ingestion) goal. A user can't "upload a file and have it P2P-shared with the room" through this option — the content must already exist as a video on an allowlisted public PeerTube instance, complete with its own transcoding pipeline, storage, and moderation.
- **Confirms, once again, the pattern already seen with `cm` custom-media manifests and raw-file/HLS players**: every CyTube-native media path expects the browser to fetch bytes from a URL (whether directly, or via a third party's own embedded player) — there is no server-side proxying and no CyTube-room-scoped P2P coordination anywhere in the existing codebase. Any HiveStream P2P layer necessarily has to live entirely outside CyTube's media-type system, which matches HiveStream's own D-008 ("CyTube is an adapter, not the foundation").
- **Where it IS genuinely useful as a reference, not a mechanism:** PeerTube-the-platform (not this embed feature) is a mature, real-world implementation of exactly the problem in HiveStream's own `OPEN-QUESTIONS.md` under "Local ingestion" — it transcodes user uploads into HLS renditions and redistributes them via P2P (historically WebTorrent, more recently p2p-media-loader in newer PeerTube releases). Worth a research pass on PeerTube's own upload → transcode → segment → swarm pipeline as prior art for HiveStream's still-open questions about segmentation/transmuxing strategy for local files, separate from CyTube's embed feature entirely.

## Suggested follow-up

Add a line to HiveStream's `OPEN-QUESTIONS.md` "Local ingestion" section noting PeerTube's own transcode/segment pipeline as a prior-art reference, and add a short note to `cytube-knowledge` that the "Accept PeerTube embeds" option was investigated and ruled out as a room-scoped P2P mechanism (so it doesn't get re-investigated later under a different framing).
