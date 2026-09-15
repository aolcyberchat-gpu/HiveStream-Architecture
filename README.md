# HiveStream Architecture

Canonical architecture and design specification for HiveStream.

> **Status:** Architecture / pre-implementation specification
>
> This repository defines the system we are trying to build. It is intentionally separated from implementation code and from CyTube-specific reverse engineering.

## Purpose

HiveStream is intended to become a **browser-native cooperative media replication system**: a group of unreliable consumer devices progressively constructs a useful distributed replica of a shared media library.

P2P playback is the first practical use case. Persistent replication is the larger architectural goal. CyTube is the first application integration, not the foundation of the system.

## Core thesis

HiveStream should be designed around:

```text
MEDIA → REPRESENTATION → SEGMENTS → REPLICAS → SWARM / PEER EXCHANGE
```

A **Replica** is a first-class architectural object, not merely a temporary cache.

## Architectural principles

1. **Media identity first** — identify what the media is independently of transport.
2. **Representation identity matters** — different encodings/renditions are distinct representations.
3. **Segment integrity is fundamental** — received bytes must be verifiable before entering a replica.
4. **HTTP fallback always exists** — P2P is an optimization and cooperative distribution mechanism, not the playback contract.
5. **Persistent replicas are not disposable caches** — retained data can later serve other peers.
6. **The player stays transport-agnostic** — playback should not care whether bytes came from HTTP, a peer, local storage, or a durable seeder.
7. **No global media catalog** — discovery should establish participation and availability without becoming a universal index of user possessions.
8. **CyTube is a thin adapter** — HiveStream Core must not depend on CyTube internals.
9. **One semantic core** — browser peers and future durable nodes should share the same media, segment, replica, and replication concepts.
10. **Evidence before complexity** — each milestone should be demonstrated with measurable evidence before the next layer is added.

## Target architecture

```text
                 ┌─────────────────────┐
                 │       CyTube        │
                 │   / Future Apps     │
                 └──────────┬──────────┘
                            │
                     CyTube Adapter
                            │
                 ┌──────────▼──────────┐
                 │   HiveStream Core    │
                 │                      │
                 │ Identity             │
                 │ Replica Model        │
                 │ Replication Policy   │
                 │ Local Ingestion      │
                 │ Distribution API     │
                 └───────┬───────┬─────┘
                         │       │
              ┌──────────▼──┐ ┌──▼────────────────┐
              │ ReplicaStore│ │ Distribution      │
              │ IndexedDB   │ │ p2p-media-loader  │
              │ → OPFS      │ │ WebRTC + HTTP     │
              └─────────────┘ └────────┬──────────┘
                                       │
                               ┌───────▼────────┐
                               │ HLS / hls.js   │
                               │ HTMLMediaElement│
                               └────────────────┘
```

This is an architectural target, not a claim that every component is implemented today.

## Identity model

HiveStream distinguishes at least:

- **Media identity** — what the media asset is.
- **Representation identity** — a specific encoding/rendition.
- **Segment identity** — an exact media segment, ideally bound to cryptographic content identity.
- **Swarm identity** — the exchange context in which peers cooperate.
- **Replica state** — what a node possesses, has verified, intends to retain, and can serve.

Media identity must not depend on a particular HLS segmentation scheme. The same source may be represented by different playlists or segment boundaries.

## Control plane and media plane

### Control plane

Coordinates metadata such as application membership, media/representation identity, playlist state, swarm membership, peer discovery, replica availability, replication policy, and local-ingestion declarations.

The control plane should not become the media store or a universal catalog.

### Media plane

Carries actual media bytes through HTTP acquisition, WebRTC data exchange, segment requests/uploads, local replica storage, and playback delivery.

The important proof is **actual media-byte transfer**, not merely peer discovery or successful WebRTC connection establishment.

## Storage model

The first storage implementation is expected to use IndexedDB behind a `ReplicaStore` abstraction. OPFS is a later candidate for high-volume byte storage and optimization.

The abstraction should allow storage implementations to change without rewriting HiveStream's identity, replication, or playback semantics.

Useful replica states include concepts such as downloaded, verified, playback-needed, retained, advertised, seeded, and evictable.

Actual browser storage quota should be discovered and respected rather than assuming a fixed capacity.

## Replication model

HiveStream is a **replication system**, not simply a player that happens to upload chunks.

A future `ReplicationManager` is expected to decide what to retain, prefetch, seed, advertise, and evict. Decisions may eventually consider playback probability, segment rarity, peer availability, playlist position, durable-seeder availability, storage budget, and eviction cost.

## Peer classes

- **Ephemeral browser peer** — watches, acquires, retains, and uploads while available.
- **Durable seeder** — higher-availability node with substantial retained storage and an explicit goal of maintaining and serving replicas.
- **Future community/super-peer** — possible later role; not required for the initial proof.

## Distribution strategy

The initial media-distribution foundation is expected to use HLS playback with `hls.js` and P2P delivery through `p2p-media-loader`, wrapped behind a HiveStream-owned Distribution API.

The first P2P proof should demonstrate two real browser peers, the same media and swarm, actual segment transfer over P2P, measurable P2P upload/download evidence, and HTTP fallback when P2P is unavailable.

A WebRTC connection alone is **not** sufficient evidence of successful P2P media distribution.

## Local ingestion

Local media should eventually enter the same pipeline as network media:

```text
LOCAL FILE → INGESTION → MEDIA IDENTITY → REPRESENTATION / SEGMENTATION
→ LOCAL PERSISTENT REPLICA → P2P ADVERTISEMENT / EXCHANGE
```

Local uploads should not become a completely separate media system.

## CyTube integration

```text
CyTube → CyTube Adapter → HiveStream Core
                         ├── Replica / Storage
                         ├── Distribution
                         ├── Replication
                         └── Ingestion
```

CyTube-specific callbacks, playlist semantics, permissions, and synchronization belong in the adapter layer. HiveStream Core should remain usable by future applications without requiring CyTube.

## Multi-tab requirement

One browser profile should not accidentally become several unrelated HiveStream peers merely because multiple tabs are open.

The exact mechanism is an implementation question. SharedWorker is a plausible candidate, but the requirement comes first: **multiple tabs belonging to one browser profile should have coherent replica and peer semantics.**

## Deliberately deferred

The architecture does not currently require WebTorrent as a second media-distribution stack, libp2p/Helia, MOQT as a replacement for the initial WebRTC media plane, OPFS as the first storage backend, WebCodecs, WebTransport services, token economics, reputation systems, recommendation graphs, sophisticated signaling, or advanced synchronization before the replica system works.

## Milestones

1. **HS-001 — Identity**
2. **HS-002 — Segment integrity**
3. **HS-003 — Actual P2P segment transfer**
4. **HS-004 — Persistent replica**
5. **HS-005 — Reuse after reload without origin availability**
6. **HS-006 — Peer churn and HTTP fallback**
7. **HS-007 — Durable seeder proof**
8. **HS-008 — Replication policy**
9. **HS-009 — Multi-tab semantics**
10. **HS-010 — Local ingestion**
11. **HS-011 — CyTube adapter**
12. **HS-012 — Higher-level synchronization**

The critical architectural proof is not merely that a video can play through WebRTC. It is that independent peers can progressively construct, retain, verify, and serve useful replicas of shared media.

## Planned specification

```text
README.md
VISION.md
ARCHITECTURE.md
CORE-CONCEPTS.md
IDENTITY.md
REPLICA-MODEL.md
MEDIA-DISTRIBUTION.md
STORAGE.md
REPLICATION.md
SEEDERS.md
CONTROL-PLANE.md
MEDIA-PLANE.md
CYTUBE-ADAPTER.md
LOCAL-INGESTION.md
MULTI-TAB.md
SECURITY.md
DECISIONS.md
ROADMAP.md
EXPERIMENTS.md
research/
```

> **Design rule:** Prove the smallest useful distributed-replica capability first. Then add persistence. Then replication. Then application integration.
