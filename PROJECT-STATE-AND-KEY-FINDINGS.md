# HiveStream Project State and Key Findings

**Authorship:** William von Meister (Project Owner) + GPT-5.6 Luna / `LUNA-HS-001` (AI Collaborator)

**Authorship rule:** This document was created collaboratively in this project. Human decisions, direction, and requirements are attributed to William von Meister; AI-authored drafting and analysis are attributed to the named AI collaborator and its unique project author ID. Author ID identifies provenance, not technical authority. Technical authority comes from evidence, reproducible experiments, project-owner decisions, and explicit adoption.

**Status:** Durable project-state summary. This is a navigation and provenance document, not a replacement for the detailed architecture or experiment records.

## 1. Purpose

This document records the high-value facts that should survive individual chat sessions and repository cleanup. It intentionally preserves conclusions, evidence status, architecture boundaries, provenance rules, and important corrections rather than every transient implementation detail.

## 2. Repository Roles

- `aolcyberchat-gpu/HiveStream-Architecture` — canonical architecture, design decisions, evidence status, and system-level specifications.
- `duckwerks/HiveStream` — implementation/product code. Treat as another collaborator's implementation; critique independently rather than silently overwriting it.
- `duckwerks/cytube-knowledge` — CyTube reverse-engineering and evidence repository.
- `backwater-battery/cytube-hivestream` — historical/reference repository containing CyTube reverse-engineering material, the hook framework, HiveStream architecture documents, and P2P-Theater-Core versions through 0.00.13.
- `calzoneman/sync` — upstream CyTube implementation/reference source.
- `aolcyberchat-gpu/P2P-Theater-Core` — earlier writable P2P theater work.

The architecture repository is the canonical home for system-level decisions unless the project owner explicitly establishes another source of truth.

## 3. Multi-LLM Provenance

The project deliberately involves multiple LLM collaborators. Identical model names do not imply identical authorship or reasoning provenance.

Current collaborator identity:

- Human: William von Meister — Project Owner
- Model: GPT-5.6 Luna
- AI author ID: `LUNA-HS-001`
- Role: AI Collaborator

Other collaborators should receive distinct author IDs. Authorship identifies who produced a document or analysis; it does not determine technical correctness.

Preferred disagreement workflow:

1. Preserve the existing contribution.
2. Produce an independent critique or analysis.
3. Separate evidence from inference and hypothesis.
4. Record an experiment that could resolve the disagreement when practical.
5. Let William von Meister decide adoption or canonical revision.

Do not overwrite another LLM's work merely because the analysis differs.

## 4. Google-Drive Artifact History

The `Google-Drive/` directory is a document/artifact dump containing work from multiple LLM instances. Its README explicitly describes the material as documents produced by Claude with Ed as project owner and later clarifies that the dump contains work from two Claude instances. This provenance must not be silently collapsed into one author. 

The TypeScript identity files in `Google-Drive/` and the former `files.zip` represented the **same coherent TypeScript artifact in two packaging/representation forms**. They were not two independent implementations.

`files.zip` has intentionally been removed from the repository. This is repository cleanup/redundancy reduction, not loss of the source-level TypeScript artifact.

Do not recreate `files.zip` merely because it once existed. The individual TypeScript files are the inspectable source representation. Recreate a package only if there is a concrete packaging or distribution requirement.

## 5. Identity Prototype — Correct Evidence Status

The Google-Drive TypeScript artifact contains a proposed four-layer identity model:

`Media -> Representation -> Segment`, with `Swarm Identity` used as transport-facing identity rather than canonical content identity.

Important properties:

- Media identity can be based on content hash, source URL, or local ingestion.
- Representation and segment identity are subordinate to Media identity.
- Swarm identity is derived for transport/distribution and is not itself canonical media identity.
- Deterministic derivation can converge when independently participating nodes already agree on MediaId/RepresentationId.
- The difficult unresolved problem is independently arriving at the same canonical MediaId from independently obtained copies.
- The prototype explicitly labels itself a design proposal and says it has not been exercised against a real p2p-media-loader Core instance.
- The canonical architecture repository does not currently contain an integrated `src/identity` implementation. Therefore the prototype must not be described as already integrated HiveStream production code.

The identity prototype should be deliberately integrated, revised, or archived later. It must not silently become canonical merely because its files exist.

## 6. Architecture Thesis

The current system thesis is:

`CyTube / Future Apps -> CyTube Adapter -> HiveStream Core (Identity, Replica Model, Replication Policy, Local Ingestion, Distribution API) -> ReplicaStore (IndexedDB initially, OPFS later) + Distribution (p2p-media-loader/WebRTC + HTTP) -> HLS/hls.js -> HTMLMediaElement`

Core semantic boundaries:

- **Control plane:** membership, identity, application state, playlist/application metadata, discovery, availability hints, replication signals, capabilities, and local-ingestion declarations. It does not carry ordinary media bytes.
- **Media plane:** actual segment bytes and their trust path.
- **Replica model:** defines what local media possession means and when bytes are trusted.
- **Replication:** decides what should be retained, prefetched, advertised, seeded, deprioritized, or evicted.
- **Distribution:** chooses local replica, peer, or HTTP origin/CDN as a path for obtaining bytes.
- **Application:** CyTube or another application decides how media is used.

CyTube is the first application adapter, not the definition of HiveStream.

## 7. Replica Semantics

A HiveStream replica is durable/verifiable local possession, not merely a cache entry.

The conceptual lifecycle distinguishes:

`DISCOVERED -> REQUESTED -> RECEIVED -> VERIFIED -> RETAINED / SERVABLE -> EVICTABLE`

The important trust transition is:

`RECEIVED -> VERIFIED -> RETAINED / SERVABLE`

HTTP and P2P bytes must be treated through the same integrity boundary. A peer's claim that it owns a segment does not make those bytes trusted.

The logical replica record should be able to associate Media ID, Representation ID, Segment ID, integrity metadata, byte length, trust/state, acquisition source, and relevant timestamps/replication metadata.

## 8. Distribution and Storage

Distribution is a semantic API above the transport. Conceptual operations include requesting a segment, subscribing to availability, reporting verification, and releasing a segment.

The intended acquisition path is:

`Playback -> local verified ReplicaStore -> peer -> HTTP origin/CDN -> verify -> ReplicaStore -> playback`

HTTP fallback is first-class, not an exceptional failure path.

ReplicaStore is an abstraction rather than an IndexedDB-specific contract. IndexedDB is the first implementation target; OPFS is a later option when byte-oriented storage/access characteristics justify it.

The safe persistence sequence is:

`receive -> verify -> persist trusted record`

## 9. Replication and Durable Seeders

Replication policy is separate from playback synchronization.

ReplicationManager should consume storage state, playback demand, media/representation information, availability/rarity, peers, durable-seeder coverage, storage pressure, transfer cost, and retention policy, then decide among actions such as retain, prefetch, advertise, seed, deprioritize, and evict.

A durable seeder is a node with an explicit higher-availability retention/serving role. Seeder status does not make unverified bytes trustworthy.

Claude's ground-up design proposed moving durable-seeder capability earlier than some prior architecture sequencing. That is a serious design proposal, not automatically a canonical decision. Preserve it as an alternative until explicitly adopted or rejected.

## 10. CyTube Research Status

The CyTube source/reverse-engineering work is substantially complete for the client-script-relevant surface.

Important verified areas include:

- Engine.IO / Socket.IO handshake and transport behavior.
- Client callback registration and callback catalog.
- Outbound event catalog.
- Queue/current-media/auto-advance/media-end behavior.
- Permissions and leader behavior.
- Channel CSS/JS injection.
- Custom media/iframe paths.
- Server-side leader/autolead behavior and relevant permission/rate-limit source.

The live `cytu.be` client is broadly consistent with the public 3.0 source branch plus operator-specific patches and small fixes. The deep-diff work did not find meaningful changes to playlist synchronization, leader/autolead, permissions, or chat rate limiting.

CyTube leader behavior is important: when a leader disconnects, the server does not simply promote another client to leader; the authoritative server timing loop can take over. Media movement uses playlist item UIDs rather than array indexes.

## 11. P2P Transport Evidence

p2p-media-loader remains the strongest current transport candidate because it provides browser-native P2P media delivery around HLS/DASH, WebRTC DataChannels, compatible WebTorrent-style signaling, HTTP bootstrap/fallback, and custom tracker support.

The project has already obtained **actual P2P media-byte transfer evidence** in a same-device two-browser experiment: 6,507,432 bytes were transferred P2P in both directions, and at least one segment was explicitly identified as `source: "p2p"` with proof marked true.

That proves actual media-byte P2P transfer in that controlled environment. It does **not** prove the entire HiveStream architecture, persistent replication, cross-device reliability, or clean cold-start symmetry.

Cross-device testing has demonstrated tracker-level SDP exchange and real WebRTC connections, but a clean phone-to-laptop P2P media-byte proof has not yet been established. Public-swarm contamination, version drift, and mobile backgrounding confounded some runs.

Mobile/NAT behavior is therefore an open transport issue, not an architecture blocker.

## 12. Evidence Discipline for Future P2P Runs

Future experiments should:

- pin exact Hls.js and p2p-media-loader versions;
- log the resolved library versions;
- log swarm ID, stream identity, and infohash/transport identifiers where available;
- use an isolated/private swarm rather than a public swarm;
- record actual P2P bytes and segment source, not merely peer connection;
- use controlled staggered starts to test cold-start symmetry;
- distinguish HTTP bytes, P2P bytes, and upload bytes;
- preserve the exact experiment record.

The use of `@latest` is unsuitable for reproducible evidence because p2p-media-loader version changes can alter stream/infohash derivation and runtime behavior.

## 13. Local Ingestion

Local files are a first-class future ingestion path:

`local file -> ingestion -> Media identity -> representation/segmentation -> verified local replica -> advertisement/P2P`

MP4Box.js is useful for local media preparation/metadata/segmentation work. ffmpeg.wasm should not become a default dependency for ordinary CyTube-page operation; it is better treated as a tool for difficult formats or controlled preprocessing when required.

## 14. Multi-Tab Semantics

A browser profile should have coherent node-level replica and peer semantics across tabs rather than accidentally creating independent contradictory nodes.

A SharedWorker is a plausible implementation mechanism, but the requirement is architectural first. Do not assume SharedWorker solves all browser lifecycle/storage/networking issues without evidence.

## 15. Security Principle

Integrity is the primary security boundary for media bytes. A peer's possession or advertisement is not proof of correctness. Received bytes should become trusted only after verification against the applicable integrity metadata.

The security design also considers identity, malicious peers, poisoned content, misleading availability claims, abuse of control-plane messages, and resource exhaustion.

## 16. Current Architecture Decisions

The decision record currently includes the following durable positions:

- browser-native cooperative replication is the target;
- architecture, implementation, and evidence are separate concerns;
- HiveStream's semantic core is independent of CyTube;
- P2P plus HTTP fallback is the normal distribution model;
- IndexedDB is the initial persistent store abstraction;
- do not prematurely introduce a second P2P stack;
- CyTube is an adapter/application, not the core definition;
- evidence should precede architectural complexity;
- local ingestion is a first-class capability;
- multi-tab semantics matter;
- playback synchronization is separate from replication;
- control-plane and media-plane responsibilities are separate.

## 17. Current Roadmap Direction

The architecture phase should now be considered sufficiently developed. The next work should be reproducible runtime implementation/evidence rather than another generic architecture layer.

Recommended evidence-first progression:

1. Freeze exact Hls.js and p2p-media-loader versions.
2. Run a clean isolated Phase 1B P2P test with version/swarm/identity logging and controlled stagger.
3. Integrate the identity model deliberately with the real p2p-media-loader Core.
4. Implement persistent IndexedDB ReplicaStore.
5. Prove reload/reuse of verified replicas.
6. Prove peer churn plus HTTP fallback.
7. Implement replication policy and durable-seeder behavior.
8. Add the CyTube adapter after the lower-level media/replica semantics are proven.

This ordering is a project direction, not permission to skip evidence or silently declare unproven steps complete.

## 18. Important Negative Findings

Several tempting directions have been explicitly de-emphasized:

- PeerTube embedding is not itself a CyTube P2P integration mechanism; it is useful prior art only.
- MOQT is not currently a replacement for the WebRTC DataChannel transport path being proven.
- A tracker connection or successful SDP exchange is not sufficient evidence of P2P media transfer.
- A peer having a segment is not equivalent to HiveStream having a verified durable replica.
- A TypeScript prototype existing in `Google-Drive/` is not equivalent to canonical implementation integration.
- The ZIP artifact was not a second independent identity implementation.
- More architecture documents are not currently the highest-value next step.

## 19. Evidence Vocabulary

Use these evidence classes consistently:

- **PROVEN** — directly demonstrated by a reproducible test or authoritative source.
- **STRONG INFERENCE** — supported by source evidence but not directly exercised in the target runtime path.
- **UNPROVEN** — plausible design or hypothesis awaiting evidence.
- **FAILED** — a tested approach that did not satisfy the stated requirement under the documented conditions.

Do not upgrade an inference to proof merely because the implementation appears straightforward.

## 20. Provenance and Canonicalization Rule

When an artifact comes from another LLM or prior project phase, preserve its provenance. A critique should normally be a separate document. A canonical revision should explicitly state what was adopted, rejected, or changed and why.

The project owner, William von Meister, is the final authority on project direction. Evidence and reproducibility determine technical confidence; author identity determines provenance.

## 21. Immediate Repository Hygiene Rule

Do not add back redundant package artifacts merely for historical completeness. Prefer source-level files plus a durable record explaining historical packaging decisions. If a removed artifact contained unique information, preserve the unique information in an appropriate text document rather than recreating an opaque archive.
