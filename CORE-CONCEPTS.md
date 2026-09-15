# HiveStream Core Concepts

## 1. Purpose

This document defines the core concepts that the rest of HiveStream must use consistently.

The architecture depends on keeping several ideas separate: what media is, how it is encoded, how it is divided into transferable units, what a node actually possesses, and how peers exchange those units.

The central model is:

```text
MEDIA
  ↓
REPRESENTATION
  ↓
SEGMENTS
  ↓
REPLICA
  ↓
SWARM / PEER EXCHANGE
```

These concepts are semantic objects, not necessarily one-to-one with database tables, JavaScript classes, network messages, or files.

## 2. Media

A **Media** object represents the underlying media asset.

Media identity answers: **What media is this?**

It should not depend on the HTTP URL, CyTube channel, WebRTC peer, HLS segmentation, or current player.

The same media may be acquired through HTTP, a peer, a durable seeder, or local ingestion. Its semantic identity should remain stable across those paths.

Media identity should also survive different HLS playlists, segment durations, or packaging choices. HLS segment boundaries therefore do not define fundamental media identity.

Descriptive metadata such as title, duration, source information, and application tags may accompany a Media object, but metadata must not be confused with identity.

The exact identity algorithm is an `HS-001` implementation decision to be established experimentally.

## 3. Representation

A **Representation** describes a particular technical encoding or rendition of a Media object.

It answers: **Which encoding of this media is being exchanged?**

Relevant properties may include codec, container, bitrate, dimensions, frame rate, audio configuration, language, quality level, and segmentation information.

One Media object may have multiple Representations. A peer exchange must identify the Representation precisely enough that segment requests are unambiguous.

## 4. Segment

A **Segment** is an exact transferable unit of a Representation and the fundamental media-plane exchange unit for the initial architecture.

Segment identity should distinguish at least its Representation, logical position, byte identity/integrity information, and useful size/timing metadata.

A sequence number is useful for playback ordering but is not automatically the complete identity of the bytes:

```text
sequence position ≠ complete byte identity
```

A received segment follows:

```text
received bytes
      ↓
identify expected segment
      ↓
verify integrity
      ↓
accept into Replica
```

Unverified bytes are not trusted replica data.

## 5. Replica

A **Replica** is the local state of media data possessed by one node.

This is the key distinction from a conventional P2P playback cache. A cache primarily exists for the local consumer; a HiveStream Replica can become a source of verified media for other peers.

A replica can be sparse, partial, playback-oriented, persistent, seedable, nearly complete, or complete for a Representation.

Conceptual state progression:

```text
DOWNLOADED → VERIFIED → PLAYBACK-NEEDED → RETAINED → ADVERTISED → SEEDABLE
```

These are conceptual states and need not be separate physical stores.

A useful replica combines verified bytes, identity, metadata, retention state, and serving capability.

Sparse replicas are valid. Several peers may collectively hold useful coverage that no single browser possesses.

## 6. Swarm

A **Swarm** is the peer-exchange context for a particular media distribution workload.

It provides a boundary within which peers discover one another and exchange relevant data.

A swarm should be associated strongly enough with the exchanged Representation that incompatible segments cannot be confused.

A swarm is **not a global catalog**. It should support questions such as which peers participate in this exchange, not what media every user owns. Actual availability is ultimately demonstrated by successful segment transfer and verification.

Swarm membership is temporary; persistent retention belongs to the Replica model.

## 7. Peer

A **Peer** is a node capable of participating in HiveStream exchange.

Peer identity is network/transport identity, not media identity.

A peer may have connection identity, capabilities, swarm memberships, replica availability, storage constraints, and current network state. A peer can disappear without invalidating the media model.

## 8. Origin

The **Origin** is an external or authoritative source from which media can initially be acquired.

The intended progression is:

```text
Origin → acquire → verify → retain → serve → additional replicas
```

HTTP origin access remains valid even when P2P is functioning because it provides bootstrap and fallback paths.

## 9. Seeder

A **Seeder** is a peer with a replica and an intentional ability to serve retained media for longer or more reliably than an ordinary ephemeral browser.

A durable seeder is not a different semantic model. It is a higher-availability implementation of the same peer/replica concepts, potentially with persistent storage, larger capacity, longer uptime, background execution, or filesystem access.

## 10. Acquisition

**Acquisition** is obtaining media bytes from an origin, peer, or local source.

```text
HTTP origin ────────┐
P2P peer ───────────┼──→ acquired bytes
Local file ─────────┘
```

Acquisition is not verification. Bytes become trusted replica data only after required identity and integrity checks succeed.

## 11. Distribution

**Distribution** is making media bytes available through one or more acquisition paths.

HiveStream initially treats HTTP delivery, WebRTC segment exchange, and local ReplicaStore reads as distribution mechanisms.

The player should not need to know which path supplied a segment.

## 12. Replication

**Replication** is the intentional process of causing useful verified media data to exist on additional peers.

This differs from simply downloading media for immediate playback. Replication is therefore a policy concern, not merely a transport feature.

## 13. Retention and eviction

**Retention** is the decision to keep verified media after immediate playback no longer requires it.

Retention is constrained by browser quota, local policy, media usefulness, rarity, peer availability, expected demand, and acquisition cost.

**Eviction** deliberately removes retained data when it is no longer worth keeping or storage pressure requires it. Eviction must also update replica availability state so metadata cannot claim possession of removed bytes.

## 14. Advertisement

**Advertisement** means declaring that a peer may be able to serve particular replica data.

Advertisement is not proof of possession:

```text
verified replica → advertise → request → actual bytes → verify → demonstrated availability
```

This distinction prevents control-plane metadata from being mistaken for media-plane evidence.

## 15. Control plane

The **control plane** coordinates exchange without carrying media payload as its primary purpose.

It can communicate identity, swarm membership, peer discovery, capabilities, availability declarations, application intent, and replication-policy inputs.

It should remain small enough that losing it does not redefine the meaning of stored media.

## 16. Media plane

The **media plane** carries actual media bytes.

For the initial architecture:

```text
HTTP                 → bootstrap / fallback
WebRTC DataChannel   → peer segment exchange
ReplicaStore         → local verified reads
```

A successful WebRTC connection without actual media-byte transfer is not a successful P2P media proof.

## 17. Local ingestion

**Local ingestion** introduces locally available media into the same HiveStream semantic model used by network-acquired media.

```text
Local media → identify → represent → segment → verify → Replica → optionally advertise
```

Local media should not require a separate identity system merely because its first source is a filesystem rather than HTTP.

## 18. Application adapter

An **Application Adapter** connects a host application to HiveStream without allowing application-specific semantics to become core semantics.

For CyTube, the adapter can translate playlist events, callbacks, permissions, current-media state, and channel membership into HiveStream operations and carry relevant HiveStream events back.

The dependency direction is:

```text
CyTube → CyTube Adapter → HiveStream Core
```

not the reverse.

## 19. Playback

**Playback** consumes the distribution system; it does not define the replication system.

The intended boundary is:

```text
HiveStream Distribution API
          ↓
HLS / hls.js
          ↓
HTMLMediaElement
```

The media element should not need to know whether a segment came from HTTP, a WebRTC peer, local persistence, or a durable seeder.

## 20. HTTP fallback

HTTP is a first-class path, not a failure of the architecture.

P2P availability varies with peer churn, signaling, NAT conditions, browser lifecycle, replica rarity, and network failures.

Therefore:

```text
P2P available   → use peer data where appropriate
P2P unavailable → use HTTP
P2P data invalid → reject and acquire elsewhere
```

## 21. Data ownership and authority

No single service should be the universal authority for all HiveStream data.

| Concern | Primary authority |
|---|---|
| Media semantics | HiveStream identity rules |
| Representation semantics | HiveStream Core |
| Segment integrity | Segment verification |
| Local possession | Local Replica |
| Peer discovery | Discovery/signaling infrastructure |
| Application state | Host application |
| Playback state | Player/application boundary |
| Retention decisions | Local replication policy |

This prevents a tracker, CyTube room, or HTTP origin from becoming an accidental universal database.

## 22. Core invariants

### Invariant 1: Media identity is transport-independent

Changing HTTP URLs, WebRTC peers, or application adapters must not inherently change the referenced Media object.

### Invariant 2: Representation identity is distinct from Media identity

Different encodings or renditions of the same media remain distinguishable.

### Invariant 3: Sequence position is not sufficient segment identity

Playback ordering must not be mistaken for complete byte identity.

### Invariant 4: Unverified bytes are not trusted replica data

Required integrity checks must succeed before data is treated as valid replica content.

### Invariant 5: Replica state is local

A peer's replica describes what that peer possesses and can serve. It does not define global ownership.

### Invariant 6: Swarm is an exchange context

Swarm membership must not become a universal media catalog.

### Invariant 7: P2P is not the playback contract

HTTP fallback remains valid.

### Invariant 8: Application integration is downstream

CyTube-specific concepts belong in the CyTube adapter, not the semantic core.

### Invariant 9: Evidence requires actual bytes

A connection, advertisement, or signaling event is not equivalent to demonstrated media replication.

### Invariant 10: Storage backend is replaceable

IndexedDB is an initial implementation choice, not the definition of a Replica.

## 23. Conceptual progression

Together, the concepts enable:

```text
Media identity
      ↓
Verified segments
      ↓
Local replica
      ↓
Peer exchange
      ↓
Additional replicas
      ↓
Persistent retention
      ↓
Policy-driven replication
      ↓
Durable seeders
      ↓
Application integration
```

The central question remains:

> Can unreliable consumer devices progressively construct and maintain a useful distributed replica of shared media?