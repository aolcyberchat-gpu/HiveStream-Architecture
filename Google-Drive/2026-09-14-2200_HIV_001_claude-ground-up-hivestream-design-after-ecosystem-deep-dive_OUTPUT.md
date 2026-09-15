# HIV-001 — "If I Designed HiveStream From the Ground Up": Claude's Independent Design, After Ecosystem Deep-Dive

**Authors:** Ed (project owner) & Claude (Anthropic)
**Date:** 2026-09-14
**Nature:** Independent architectural opinion, explicitly requested after resyncing `duckwerks/HiveStream` and `duckwerks/cytube-knowledge` in full and doing fresh, independent research into the current (2026) state of MoQ/WebTransport, WebRTC P2P scaling, OPFS, libp2p, and the commercial P2P-CDN industry (Peer5, Streamroot/CenturyLink). This does not override DEC-000, DEC-001, or DEC-002 — it responds to the same question a third time, with new external research folded in, and should be read alongside them rather than instead of them.

---

## 0. Where this document agrees with, and departs from, DEC-000/001/002

DEC-000, DEC-001, and DEC-002 already converge on the core stack (HLS/hls.js/p2p-media-loader/WebRTC), a self-hosted WSS tracker, IndexedDB-then-OPFS, dropping WebTorrent from the core, TypeScript+esbuild for HiveStream's own layer, and evidence-discipline-from-commit-one. I have nothing to add against any of that — three independent passes reaching the same stack is a strong signal, and it's now also externally corroborated (Section 2).

Where I depart is less about the stack and more about **what problem HiveStream is actually solving**, which I think has been slightly mis-scoped across all three prior documents by implicitly modeling HiveStream on commercial P2P-CDN products (Peer5, Streamroot, PeerTube) that solve a different problem than the one stated in `LLM-HANDOFF.md` and `PROJECT-STATE.md`.

---

## 1. Two misconceptions worth heading off before they cost engineering time

### 1.1 MoQ/WebTransport is not a WebRTC replacement for this project

2026 is a real inflection year for Media over QUIC: `draft-ietf-moq-transport` is at revision 18+ heading toward Working Group Last Call, WebTransport now ships in Chromium, Firefox, *and* Safari/iOS 26.4, and eleven vendors demonstrated interop at NAB 2026. If this project searches "P2P video 2026" at any point, MoQ will come up, and it would be a mistake to treat it as a newer WebRTC.

MoQ is a **publish/subscribe transport routed through relays** — architecturally it collapses the difference between a WebRTC SFU and an HLS CDN, but it is still fundamentally a **client-to-relay-to-client(s)** model, not NAT-traversed browser-to-browser like WebRTC's `RTCPeerConnection`. Adopting MoQ would mean *running relay infrastructure* (Cloudflare and others are starting to offer this, but it's still infrastructure you depend on or pay for), which is the exact origin-dependency HiveStream exists to reduce. WebRTC DataChannels remain the correct choice for actual browser-to-browser segment exchange. MoQ's only plausible future role in this project is as a *replacement for the HTTP/HLS origin-delivery leg* (Tier 0 in DEC-001's model) — worth a bookmark once MoQT reaches RFC status and gets a p2p-media-loader-equivalent, not worth touching now.

### 1.2 "WebRTC P2P doesn't scale past ~4-12 peers" does not apply to this project

This is a genuinely common and genuinely misleading claim in 2026 web-dev discourse, and it's worth explicitly ruling out because it could cause someone to second-guess the whole approach later. The scaling ceiling being described is for **full-mesh continuous media** — a video call where every peer uploads a live stream to every other peer, so bandwidth grows O(n²). That is not HiveStream's model at all. p2p-media-loader (like WebTorrent before it) does **segment-level swarm exchange**: each peer holds a handful of partial connections and trades discrete, already-downloaded chunks — the same architecture as BitTorrent, not a video call.

This isn't just theoretical: Peer5 supported a single event with 1M+ concurrent viewers on this model, and Streamroot's peer-assisted delivery let CenturyLink offload 60–70% of CDN traffic during World Cup-scale live sporting events, in production, years before this project started. The segment-swarm model is proven at a scale wildly beyond anything a CyTube room will ever need. **This part of the architecture deserves more confidence than any of the three prior documents gave it** — it's not a hypothesis to validate so much as a well-worn commercial pattern to correctly implement.

---

## 2. What actually is HiveStream's problem, and how is it different from Peer5/Streamroot/PeerTube?

This is the part I think has been under-examined. Peer5 and Streamroot were built for **live events and viral VOD spikes** — a huge number of people watching the *same* thing at the *same* moment, for a short window, where P2P absorbs peak demand. PeerTube's use of p2p-media-loader is closer to HiveStream's but still oriented around federated, relatively public/anonymous swarms per video.

HiveStream's own stated thesis (`LLM-HANDOFF.md`) is different in kind, not just scale:

> A small, semi-private room of the same regulars, rewatching the same fixed library (e.g. American Dad reruns) repeatedly, over a long time horizon, where most sessions have only a handful of concurrent viewers.

That's not a live-event P2P-CDN problem. It's much closer to **a small private BitTorrent swarm per episode, whose seeders are "whoever in this room has watched this episode before and happens to be online right now."** That reframing matters for two concrete reasons:

1. **Concurrency overlap, not swarm engineering, is the real bottleneck for a small room.** If a 6-person CyTube room is rewatching an episode and only 2 people are online, the P2P swarm for that specific episode has at most 2 members regardless of how good the replication logic is. The realistic near-term origin-bandwidth savings for a small room are bounded by how often multiple regulars are simultaneously online *and* have that specific episode cached — not by architectural sophistication. None of DEC-000/001/002 states this plainly, and I think the project's own success criteria (`PROJECT-STATE.md`'s exit condition: "measurable P2P segment traffic") should be read with this ceiling in mind — measurable and small-but-real is a legitimate, expected outcome for a small room, not a sign something's wrong.

2. **This reframing changes where the highest-leverage engineering investment is.** See Section 3.

---

## 3. The single highest-leverage idea I'd add: build the always-on seeder early, not late

All three prior documents put a "durable seeder" / Tier 2 node at the *end* of the roadmap (DEC-000's Tauri desktop phase, DEC-001's Tier 2, `ROADMAP.md`'s Phase 6-adjacent territory). For Peer5/Streamroot's live-event model that ordering makes sense — momentary peer overlap is already enormous at their scale, so a persistent node adds little. **For HiveStream's small-persistent-room model, I'd invert that.**

A single lightweight, always-online peer (a cheap always-on VM — the same box already being considered for the WSS tracker in WS-083 could double as this — running a headless browser context or a native `p2p-media-loader-mobile`-style client that just sits in the room and holds the library) directly solves the "nobody else happens to be watching right now" cold-start problem from Section 2, cheaply, without needing sophisticated ephemeral-peer replication logic first. It's a much smaller build than a full `ReplicationManager`, and it delivers real origin-bandwidth savings from day one of Phase 2, rather than waiting for enough simultaneous viewers to accumulate organically.

This is reinforced by a concrete browser platform constraint worth naming explicitly: **ordinary viewers' browser tabs are not reliable long-term seeders even when the person leaves the room open.** Backgrounded/inactive tabs get CPU and network throttled by Chrome and Firefox, and on Android a backgrounded tab can be suspended or killed by the OS well before the browser process itself closes. Counting on regular viewers' idle tabs to keep seeding the library between watch sessions is optimistic; a dedicated always-on node is the actual answer to persistence, not an enhancement on top of ordinary peer behavior.

**Recommendation:** move a minimal always-on seeder node up to immediately after Phase 1 (before Phase 3's Reuse work, possibly even before finishing Phase 2's full persistence design) — it's a cheap, high-confidence win that doesn't require the harder replication-policy design to already be right.

---

## 4. Media identity: don't build the general case DEC-001 describes — build the case you actually have

DEC-001's four-layer identity model (Media → Representation → Segment → Swarm) is conceptually correct and I'd keep the layering. But DEC-001's framing — "two independently obtained copies of equivalent media should have a path to the same Media Object" — describes a **general content-identification problem** (something closer to what a public torrent tracker or a service like TMDB/AcoustID solves), and that's more machinery than this project's actual situation requires.

HiveStream's actual library is small, known, and largely fixed (a rerun-heavy CyTube room's catalog doesn't grow like a general video platform's does). A simple, deliberately narrow identity scheme — e.g., a manually or semi-automatically curated `{tmdb_episode_id, source_hash, representation_params}` tuple — solves the real problem (episodes stay identifiable and shareable across sessions) without building general perceptual-matching or fuzzy-identity infrastructure that D-007 already warns against building prematurely. Treat the general case as a possible future extension if the library ever grows unpredictably, not as day-one scope.

---

## 5. Storage: keep OPFS, but the Firefox cap is a real number to test against, not a footnote

OPFS is correctly the recommended direction (Baseline widely available since March 2023, and this project's earlier research already flagged Android Chrome support since Chrome 109). One concrete number worth having on hand early: **Firefox currently caps OPFS at roughly 10GB per origin**, while Chromium-based browsers scale with available device storage. For a persistent multi-episode library meant to accumulate over a long-running room's lifetime, 10GB is a real, testable ceiling (not huge for HD video — worth an early back-of-envelope check against target segment sizes/bitrates and expected library size), and eviction-policy design (already flagged as an open question in `OPEN-QUESTIONS.md`) should be validated against that number specifically, not treated as an abstract "later" concern.

---

## 6. One more infrastructure note: libp2p is real, mature, and still the wrong choice here

Purely for completeness, since it's an obvious "why not just use X" question: `js-libp2p` v1.0.0+ has real production browser-to-browser WebRTC support with hole-punching (DCUtR) that doesn't require a signaling server after initial rendezvous. It's a legitimate, mature alternative to a hand-rolled WSS tracker + p2p-media-loader combination. I'd still avoid it here — it's a general-purpose p2p networking stack (DHT, pubsub, multi-transport, content routing) built for open, permissionless networks, and HiveStream's actual discovery problem (peers who are already members of a known CyTube room) is much narrower than what libp2p is designed to solve. Pulling in that much machinery to solve a smaller, closed-world problem would be the same category of premature complexity D-007 warns against, just from a different direction than WebTorrent.

---

## 7. Summary table

| Area | Verdict | Relationship to DEC-000/001/002 |
|---|---|---|
| Core stack (HLS/hls.js/p2p-media-loader/WebRTC) | Keep | Agrees — now with commercial-scale (Peer5/Streamroot) evidence behind it |
| MoQ/WebTransport | Not a fit for the P2P layer; possible future origin-delivery replacement only | New — not addressed in any prior DEC doc |
| "WebRTC P2P doesn't scale" concern | Does not apply — segment-swarm ≠ mesh call | New — names and defuses a real, common misconception |
| Project's actual problem shape | Small persistent-room rewatch swarm, not a live-event P2P-CDN | New reframing — changes how success/scale should be read |
| Always-on seeder node | Move early (right after Phase 1) | Reorders DEC-000/001's "durable seeder = late phase" placement |
| Browser tab reliability as seeder | Explicitly unreliable (throttling/suspension) — don't design around it | New — concrete platform constraint |
| Media identity | Narrow, curated scheme for a small known library; general case deferred | Scales back DEC-001's general-case framing |
| OPFS | Keep | Agrees — adds the concrete Firefox ~10GB cap as an early test target |
| libp2p | Considered, deliberately not adopted | New comparison — reinforces D-007 from a different angle |

---

## 8. Primary sources

In addition to `duckwerks/HiveStream` (all root docs, DEC-000, DEC-001, PHASE-1-P2P-PROOF.md) and `duckwerks/cytube-knowledge` (particularly the 2026-09-13 checkpoint and the P2P-Media-Loader reuse findings):

- IETF `draft-ietf-moq-transport-17`/-18/-20: https://datatracker.ietf.org/doc/draft-ietf-moq-transport/
- WebTransport browser support (Safari/iOS 26.4): reported April 2026 industry coverage of NAB Show 2026 MoQ interop (Ant Media, AWS, Bitmovin, Cloudflare, et al.)
- WebRTC P2P mesh scaling ceiling (full-mesh calls specifically): https://antmedia.io/webrtc-scalability/ ; https://bloggeek.me/webrtc-p2p-mesh/
- Peer5 (1M+ concurrent viewers on P2P CDN): TechCrunch coverage, https://techcrunch.com/?p=1519952
- Streamroot / CenturyLink acquisition (60–70% CDN offload at World Cup scale): https://www.lightreading.com/video/video-storage-delivery/why-centurylink-bought-streamroot-/d/d-id/754050
- Novage `p2p-media-loader-mobile` (Kotlin/Android): https://github.com/Novage/p2p-media-loader-mobile
- OPFS Baseline status and Firefox's ~10GB cap: MDN, https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system ; https://github.com/kiwix/kiwix-js-pwa
- `js-libp2p` v1.0.0 browser WebRTC + DCUtR: https://github.com/libp2p/js-libp2p

---

## 9. Final position

Peer5 and Streamroot both got acquired and effectively disappeared as standalone products — not because P2P video distribution failed, but because the underlying plumbing became commodity infrastructure rather than a defensible product on its own. That's a useful cautionary data point rather than a discouraging one: it confirms (again, independently) DEC-000 and DEC-001's shared instinct that **HiveStream's actual value isn't the P2P transport layer — it's the persistent, room-scoped, rewatch-aware replication behavior sitting on top of it.** The transport layer should be built quickly, correctly, and then mostly left alone; the genuinely novel, worth-protecting engineering time is in making a small, recurring room of real people increasingly serve its own reruns to itself.
