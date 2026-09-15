Human Project Lead: William / AI: Claude Sonnet 5 (Anthropic)
Status: WORKING / SCRATCH LAYER

# Three-Repo Resync — cytube-knowledge, ai-memory, HiveStream

Full resync pass across duckwerks/cytube-knowledge, duckwerks/ai-memory, and
duckwerks/HiveStream, run 2026-09-10.

---

## 1. duckwerks/cytube-knowledge — unchanged

95 files, identical to the state already captured after the WS-071/072/073(x2)
additions covered in the prior resync
(2026-09-08-23-57_cytube-knowledge-resync.md). No new commits since then.

---

## 2. duckwerks/ai-memory — empty stub, not yet in use

Two files: memory.json and memory.md, both effectively blank (1 byte each).
Nothing to resync. Flagged for awareness only — if this repo becomes active
later, it will need its own dedicated review.

---

## 3. duckwerks/HiveStream — NEW dedicated product repo

This is a genuinely new development: a separate, dedicated repository for
HiveStream product code and architecture, distinct from the research-only
duckwerks/cytube-knowledge repo. The split is now explicit and stated directly
in the HiveStream README:

"CyTube reverse engineering, runtime tests, P2P engine research, and
architecture investigations are maintained separately in the cytube-knowledge
repository so that research evidence remains distinct from product code."

Still signed "Human Project Lead: Elwood Edwards / AI Research & Engineering
Assistant: GPT-5.6 Luna (OpenAI)" — now consistent across two independently
created repositories, which makes this look like an intentional, stable
project persona for the ChatGPT/HiveStream track rather than an accidental
mix-up. Treat "Elwood Edwards" as the established signer for HiveStream-track
documents going forward unless told otherwise.

### Structure

README.md, PROJECT-STATE.md, ARCHITECTURE.md, ROADMAP.md, DECISIONS.md,
OPEN-QUESTIONS.md, LLM-HANDOFF.md, plus src/, tests/, experiments/, docs/,
archive/ directories (mostly scaffolding so far, but experiments/ has real
content — see below).

### Ten durable architectural decisions (DECISIONS.md)

D-001: HiveStream is a P2P media-distribution project; playback sync is secondary.
D-002: Research (cytube-knowledge) and product (HiveStream) code stay separate.
D-003: p2p-media-loader is the initial media-plane foundation, not a custom transport.
D-004: HiveStream owns its own application-level media identity, separate from transport/swarm IDs.
D-005: P2P is an optimization, not the playback contract — HTTP remains bootstrap/fallback.
D-006: IndexedDB first; OPFS evaluated later.
D-007: No second media-gossip protocol until a real requirement exists (the existing P2P engine's announce/request mechanism is sufficient for now).
D-008: CyTube is an adapter target, not the foundation the architecture is built around.
D-009: Prove the smallest thing first — next milestone is a measurable two-browser P2P segment-transfer proof.
D-010: Local file uploads are first-class media ingestion, not a temporary/secondary path.

### Priority order (PROJECT-STATE.md) — CyTube integration is deliberately last

1. P2P media distribution
2. Persistent media reuse
3. Local media ingestion
4. Swarm discovery and coordination
5. Playlist/media identity
6. Seeding and reseeding
7. Server bandwidth reduction
8. Playback synchronization
9. CyTube leader behavior compatibility

Explicit scope guardrail: do not let the first MVP depend on WebTorrent,
libp2p/Helia, WebCodecs, WebGPU, token/reputation systems, recommendation
graphs, sophisticated playback sync, a custom gossip protocol, or CyTube
modification before the standalone P2P path is proven.

### Phase 1 proof — implemented and ready to run, not just planned

experiments/phase-1-p2p-proof.html is a real, self-contained, 633-line test
page using the actual Novage P2P Media Loader + Hls.js integration (verified
non-trivial — references p2p-media-loader, Hls.js, WebRTC, real event
handlers, not a stub). Paired with docs/PHASE-1-P2P-PROOF.md, a precise test
procedure with exact commands for Termux:

```
cd HiveStream
python -m http.server 8080
```
then open http://127.0.0.1:8080/experiments/phase-1-p2p-proof.html on two
browser instances (real devices recommended over an emulator, since WebRTC
NAT behavior differs).

**Test procedure:** Browser A starts first, loads the HLS stream, acquires
several segments via HTTP. Browser B joins with the identical HLS URL and
identical swarm ID, and the page measures peer count, HTTP bytes, P2P bytes
downloaded/uploaded, segment IDs, and playback state.

**Evidence discipline codified directly in the doc:**
- PROVEN: actual P2P segment/byte traffic reported by the P2P Media Loader event path.
- STRONG INFERENCE: a connected WebRTC peer with no P2P media bytes — proves connectivity, not media transfer.
- UNPROVEN: a P2P-enabled player or a tracker reporting a peer, without confirmed byte transfer.

Strongest possible Phase 1 result: peers connected > 0, P2P downloaded > 0,
P2P uploaded > 0, segments via P2P > 0 (not all necessarily on the same
browser at the same moment — one browser can be the HTTP source while the
other receives P2P segments).

**Phase 1 exit condition:** a reproducible two-browser run with actual media
bytes moving through the P2P path. After that: Phase 2 (persistence) is next.

### Full roadmap (ROADMAP.md) — six phases

1. P2P proof (current, implemented, awaiting a real test run)
2. Persistence — IndexedDB-backed segment/metadata storage surviving reload
3. Reuse — retained segments served to later playback without origin traffic
4. Local ingestion — user-supplied local video files become shareable swarm media
5. Replication — intentional retain/prefetch/seed/evict policy
6. CyTube integration — adapter mapping playlist items to HiveStream media identities, last on purpose

### OPEN-QUESTIONS.md — consistent with existing research, nothing contradicted

The loader-bootstrap timing question ("when pre-existing segments are
inserted into persistent storage, exactly when does an active p2p-media-loader
instance discover and announce them?") is carried forward verbatim as still
open — matches the same open boundary already identified in
HIVESTREAM-P2P-MEDIA-LOADER-REUSE-FINDINGS.md in the cytube-knowledge repo.
No contradictions found between the two repos' open-question sets.

---

## 4. Practical next step

This is the first genuinely actionable engineering milestone in the HiveStream
thread: the Phase 1 P2P proof experiment is real, implemented, and has an
exact Termux procedure already written. This is something that could
realistically be run using two phones on the same Wi-Fi network, with the
JSON results from each browser fed back for interpretation.

*End of document.*
