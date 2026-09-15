# HiveStream Architecture

## 1. Scope

This document defines the technical architecture of HiveStream as a browser-native cooperative media replication system.

It describes system boundaries, domain objects, data flow, storage, distribution, replication, peer roles, application adapters, and failure behavior.

It is intentionally an architecture specification rather than an implementation guide. Concrete APIs, schemas, and code should be derived from these boundaries and then validated by experiments.

The architecture follows the vision established in `VISION.md`: P2P playback is the first practical workload, while persistent distributed media availability is the larger objective.

## 2. System model

The central model is:

```text
MEDIA
  ↓
REPRESENTATION
  ↓
SEGMENTS
  ↓
REPLICAS
  ↓
SWARM / PEER EXCHANGE
```

A media object describes what the media is. A representation describes a particular encoding or rendition. A segment is an exact transferable unit of that representation. A replica describes the useful verified state held by one node.

A swarm is the exchange context in which peers discover and communicate about a particular replication workload. It is not a universal catalog of all media owned by all users.

The high-level dependency direction is:

```text
Application
    ↓
Application Adapter
    ↓
HiveStream Core
    ├── Identity
    ├── Replica Model
    ├── Replication Policy
    ├── Local Ingestion
    └── Distribution API
          ↓
    Storage / P2P / HTTP
          ↓
    HLS / hls.js
          ↓
    HTMLMediaElement
```

The player is therefore downstream of the semantic media and replica model rather than defining it.

## 3. Architectural layers

### 3.1 Application layer

The application decides what it wants to play, expose, queue, or synchronize.

Examples include CyTube and future applications that have no knowledge of CyTube-specific callbacks.

The application may provide:

- media references;
- playback intent;
- playlist state;
- application permissions;
- user-facing policy choices.

It should not own the meaning of a HiveStream replica.

### 3.2 Adapter layer

An adapter translates application-specific state into HiveStream operations and translates HiveStream events back into application behavior.

For CyTube, this is where playlist callbacks, room membership, permissions, current-media state, and synchronization belong.

### 3.3 HiveStream Core

The Core owns the semantic model:

- Media identity;
- Representation identity;
- Segment identity and integrity;
- Replica state;
- Swarm participation;
- Distribution policy boundaries;
- Replication policy;
- Local ingestion semantics.

The Core must remain independent of any single application or player implementation.

### 3.4 Infrastructure layer

Infrastructure implements the Core's required mechanisms:

- HTTP acquisition and fallback;
- WebRTC peer exchange;
- signaling and peer discovery;
- local persistent storage;
- browser quota management;
- HLS and playback integration.

Infrastructure may change without changing the semantic model.

## 4. Core domain objects

### Media

`Media` identifies the underlying media asset independently of its transport and segmentation.

Media identity must not depend on a particular HLS playlist or segment boundary. The same source may have multiple representations or different segmentation strategies.

### Representation

`Representation` identifies a particular encoding or rendition of a Media object.

A representation can include attributes such as codec, container, bitrate, dimensions, audio configuration, and segmentation metadata.

### Segment

`Segment` is an exact transferable unit of a Representation.

A segment should have stable identity and integrity information sufficient to verify received bytes before they become part of a replica. Cryptographic hashes are the preferred integrity primitive where practical.

### Replica

`Replica` is the local state of a node's possession of media data.

It describes which segments are present, which have been verified, which are retained, which are useful for playback, and which can be served to another peer.

Replica state is a first-class architectural object rather than an incidental cache implementation detail.

### Swarm

`Swarm` identifies the peer-exchange context for a media/representation workload.

Swarm membership answers questions such as which peers are participating and which exchange context they belong to. It does not become a global inventory of every media object stored by every participant.

## 5. Identity boundaries

Identity is deliberately separated into layers:

```text
Media identity
      ↓
Representation identity
      ↓
Segment identity
      ↓
Replica state
      ↓
Swarm/exchange identity
```

Transport identity is separate from media identity.

A WebRTC peer identifier, tracker identifier, HTTP URL, or application room identifier must not become the canonical identity of the media itself.

This separation allows the same media semantics to survive changes in transport, player, application, segmentation, and node type.

## 6. Replica model

A replica is the local, potentially persistent set of verified media data held by a node.

Useful state dimensions include:

- downloaded;
- verified;
- playback-needed;
- retained;
- advertised;
- seedable;
- evictable.

These states are policy and evidence, not necessarily separate physical stores.

A segment should not be advertised as usable replica data merely because bytes arrived. Verification must occur first.

The replica model must support both sparse and complete replicas. A browser peer may hold only a useful subset of a media object, while a durable seeder may retain a substantially larger or complete representation.

## 7. Control plane

The control plane carries coordination information, not the media payload itself.

It may include:

- application membership;
- media and representation identity;
- playlist or playback intent;
- swarm membership;
- peer discovery information;
- replica availability declarations;
- local capabilities;
- replication-policy inputs;
- local-ingestion declarations.

The control plane must not become a universal media catalog or a database containing all media bytes.

A tracker or signaling service should answer narrowly scoped discovery questions such as which peers participate in a swarm and how they may establish a connection.

It is not the authority for the truth of a replica. Actual possession is established by successful segment exchange and verification.

## 8. Media plane

The media plane moves actual media bytes.

Its initial mechanisms are:

- HTTP acquisition;
- WebRTC DataChannel exchange;
- local replica reads;
- segment requests and uploads.

The distinction between control and media planes is important for proof. Establishing a WebRTC connection is not evidence that P2P media delivery works. A valid Phase 1 proof requires measurable transfer of actual media segments between independent peers.

HTTP remains a legitimate bootstrap and fallback path. P2P should be treated as an optimization and replication mechanism, not as a requirement for basic playback.

## 9. Storage and ReplicaStore

Storage is exposed through a HiveStream-owned `ReplicaStore` abstraction.

The first browser implementation should target IndexedDB because it is broadly available and suitable for structured segment metadata plus binary data.

OPFS is a later candidate for workloads that benefit from lower-level file-like byte access. It should not be made the architectural dependency before the replica semantics are proven.

The storage abstraction must hide the physical backend from the rest of HiveStream.

The system must use browser storage quotas rather than assume an arbitrary fixed capacity. Retention and eviction policy must account for the actual available budget and browser behavior.

A stored segment is useful only when its identity and integrity can be established. Corrupt or unverifiable data must not silently become a trusted replica.

## 10. Distribution API

The application and player should interact with a HiveStream-owned Distribution API rather than directly depending on a specific P2P library.

The initial media-plane implementation may use `p2p-media-loader` because it provides an existing HLS/DASH/WebRTC delivery foundation.

Conceptually:

```text
HiveStream Distribution API
            ↓
     p2p-media-loader
            ↓
 HTTP + WebRTC / WebRTC DataChannels
```

The abstraction is intentional. It allows the underlying transport implementation to change without forcing the Core, CyTube adapter, or player integration to change with it.

The Distribution API should expose media delivery semantics, not transport-specific details whenever possible.

## 11. ReplicationManager

The future `ReplicationManager` is responsible for deciding what local data should be retained and offered to other peers.

Potential policy inputs include:

- playback probability;
- segment rarity;
- peer availability;
- playlist position;
- durable-seeder availability;
- local storage budget;
- acquisition cost;
- eviction cost;
- recent demand.

The manager may eventually decide to:

- retain;
- prefetch;
- advertise;
- seed/upload;
- evict.

Replication should therefore become deliberate policy rather than an accidental side effect of playback.

## 12. Peer and node classes

HiveStream should share one semantic core across several node classes.

### Ephemeral browser peer

A normal browser participant with limited lifetime and storage. It can acquire, verify, use, and potentially share media while the application is active.

### Durable seeder

A higher-availability node with persistent storage and longer uptime. It can preserve useful replicas across ordinary browser churn.

### Future community or super-peer

A future node class may provide stronger availability, coordination, or storage without changing the fundamental Media/Representation/Segment/Replica model.

The architecture should not require these node types to use identical runtime infrastructure. They should share the same semantic contracts.

## 13. Local ingestion

Local media is a first-class input to the same pipeline.

Conceptually:

```text
Local file
   ↓
Ingestion
   ↓
Media identity
   ↓
Representation
   ↓
Segmentation
   ↓
Verified local replica
   ↓
Advertisement / peer exchange
```

Local ingestion should not create a separate semantic model for uploaded or locally owned media.

The initial implementation may use local MP4 files as an experiment, while preserving the same identity and replica contracts used for network-acquired media.

## 14. CyTube adapter

CyTube is an application integration, not the foundation of HiveStream.

The adapter is responsible for translating CyTube-specific concerns such as:

- channel membership;
- playlist events;
- current-media state;
- permissions;
- CyTube callbacks;
- application-level synchronization.

The adapter calls HiveStream Core services for media identity, distribution, storage, replication, and ingestion.

The desired dependency direction is:

```text
CyTube
  ↓
CyTube Adapter
  ↓
HiveStream Core
```

Not:

```text
HiveStream Core
  ↓
CyTube internals
```

This keeps future applications possible without importing CyTube assumptions into the media-replication engine.

## 15. Multi-tab semantics

A single browser profile may contain multiple tabs running the same application. Those tabs must not accidentally become several independent replicas with contradictory ownership and peer state.

The architectural requirement is therefore explicit multi-tab semantics.

A `SharedWorker` or another same-origin coordination mechanism is a plausible implementation approach, but the architecture does not mandate one before an experiment establishes the correct behavior.

The important invariant is that multiple application views can share one coherent local HiveStream identity and replica state when policy requires it.

## 16. Durable node relationship

Durable nodes are not a separate product architecture. They are higher-availability implementations of the same semantic model.

A future desktop or server runtime may provide:

- larger storage;
- filesystem access;
- longer uptime;
- background execution;
- stronger seeding behavior.

The browser and durable implementations should continue to agree on media, representation, segment, replica, and swarm semantics.

## 17. Failure and fallback model

HiveStream must assume failure is normal.

Important failure cases include:

- origin unavailable;
- peer unavailable;
- peer churn;
- signaling failure;
- corrupt segment;
- stale replica metadata;
- storage quota exhaustion;
- browser eviction;
- no P2P-capable peer available.

Expected behavior is graceful degradation rather than assuming an always-connected swarm.

Examples:

```text
P2P available
    → request segment from peer

P2P unavailable
    → request segment through HTTP

Peer data fails verification
    → reject data
    → acquire another copy

Local storage full
    → apply replication/eviction policy

Origin unavailable + verified local replica exists
    → serve/use retained data
```

The architecture therefore remains useful even when P2P is temporarily absent.

## 18. Evidence and proof requirements

Architecture claims must be tied to measurable experiments.

The first critical proof is not “WebRTC connected.” It is:

1. Two independent browser peers join the same media/swarm workload.
2. Both can identify the same representation.
3. One peer obtains an actual media segment.
4. The other peer receives actual media bytes over the P2P path.
5. The received segment is verified.
6. P2P upload/download measurements show non-zero media transfer.
7. HTTP remains available as fallback.

After that proof, the next architectural evidence should demonstrate persistent storage, reuse after reload, peer churn, and durable seeding.

The guiding rule is:

> Evidence before complexity.

## 19. Deferred architecture

The following are intentionally not foundational requirements for the first implementation:

- WebTorrent as a second media-distribution stack;
- libp2p/Helia;
- MOQT as a replacement for the initial WebRTC media plane;
- OPFS as the first storage backend;
- WebCodecs as a prerequisite;
- WebTransport service infrastructure;
- token economics;
- reputation systems;
- recommendation graphs;
- a global media catalog;
- sophisticated synchronization before media replication works;
- elaborate signaling infrastructure before the smallest P2P proof exists.

These may become useful later, but introducing them before the core replica behavior is measurable would make the system harder to validate.

## 20. Milestone mapping

The architecture maps to the following progression:

| Milestone | Architectural proof |
|---|---|
| HS-001 | Stable media/representation identity |
| HS-002 | Segment integrity and verification |
| HS-003 | Actual P2P segment transfer |
| HS-004 | Persistent local replica |
| HS-005 | Reuse after reload/origin interruption |
| HS-006 | Peer churn and HTTP fallback |
| HS-007 | Durable seeder |
| HS-008 | Policy-driven replication |
| HS-009 | Coherent multi-tab semantics |
| HS-010 | Local media ingestion |
| HS-011 | CyTube adapter |
| HS-012 | Higher-level application synchronization |

The ordering is deliberate. Media identity, segment integrity, transfer, and persistence establish the foundation before application-specific synchronization is allowed to dominate the design.

## 21. Architectural invariant

The most important invariant is:

```text
Application semantics
        ≠
HiveStream media semantics
        ≠
Transport implementation
        ≠
Physical storage backend
```

Those layers cooperate through explicit contracts.

If a future transport, player, storage backend, application, or node runtime changes, the verified media and replica model should remain intelligible and reusable.

That separation is what allows HiveStream to evolve from a P2P playback experiment into a distributed media-replica system without rebuilding its semantic foundation.