# HiveStream Identity Model

**Authorship:** William von Meister (Project Owner) + GPT-5.6 Luna / `LUNA-HS-001` (AI Collaborator)

**Authorship rule:** This document was created collaboratively in this project. Human decisions, direction, and requirements are attributed to William von Meister; AI-authored drafting and analysis are attributed to the named AI collaborator and its unique project author ID. Author ID identifies provenance, not technical authority.

## 1. Purpose

This document defines the semantic identity boundaries between HiveStream's core media objects. It is intentionally narrower than an implementation specification: the goal is to establish what must be identifiable and how those identities relate before implementation details are locked down.

The central model is:

`MEDIA → REPRESENTATION → SEGMENTS → REPLICAS → SWARM / PEER EXCHANGE`

## 2. Identity Principles

1. **Media identity is independent of transport.** A URL, HTTP origin, WebRTC peer, tracker, or CyTube channel is not itself the identity of the media asset.
2. **Representation identity matters.** Different encodings or renditions of the same logical media must not be silently treated as identical byte streams.
3. **Segment identity is representation-scoped.** A segment belongs to a particular representation and must be identifiable as an exact transferable unit.
4. **Replica is state, not a second media identity.** A replica describes a node-local possession and verification state for media/representation/segments.
5. **Swarm identity describes an exchange context.** It is not a global media catalog entry and must not become the canonical identity of the media itself.
6. **Network peer identity is separate.** A transport-level peer identifier identifies a participant in an exchange, not the media it possesses.

## 3. Media Identity

A **Media** object represents the logical media asset.

Media identity answers:

> "Which logical media are we talking about?"

It must remain stable across changes in acquisition URL, transport mechanism, playback application, and participating peers.

The architecture does not yet mandate a particular identifier-generation algorithm. That decision requires evidence about the available source metadata and ingestion paths.

## 4. Representation Identity

A **Representation** identifies a particular encoding/rendition of a Media object.

Relevant properties may include:

- codec;
- container or packaging;
- resolution;
- bitrate;
- frame rate;
- audio configuration;
- segmentation characteristics;
- other properties required to distinguish byte-compatible media streams.

The important invariant is:

`one Media → one or more Representations`

Two representations may describe the same underlying logical media while remaining distinct for distribution and verification purposes.

## 5. Segment Identity

A **Segment** is an exact transferable unit belonging to a Representation.

A segment identity should be sufficient to distinguish the exact content unit needed by the distribution layer. Candidate identity inputs include sequence information, byte length, timing metadata, and cryptographic content hash, but the final canonical scheme is intentionally not fixed here.

The critical invariant is:

`Segment identity must not allow incompatible byte content to be treated as the same trusted segment.`

Verification is therefore part of the trust boundary between acquired bytes and a trusted replica.

## 6. Replica Identity and State

A **Replica** is node-local state describing possession of some or all of a Representation's segments.

A replica is not merely an HTTP cache entry. It is an explicit HiveStream domain concept because retained media may later be reused or served to another peer.

Replica state can include:

- acquired/downloaded;
- verified;
- playback-needed;
- retained;
- advertised;
- seedable;
- evictable.

A replica may be sparse or complete.

The conceptual relationship is:

`Node + Representation + segment set + verification/retention state → Replica`

The architecture does not require a globally unique identifier for every local replica at this stage. If implementation later needs one, it should be derived from stable domain references and local-node identity rather than confused with Media identity.

## 7. Swarm Identity

A **Swarm** identifies an exchange context in which peers can discover and exchange segments for a compatible media representation.

A swarm is deliberately not:

- a global media catalog;
- the canonical identity of a Media object;
- proof that a peer actually possesses usable media bytes;
- a replacement for segment verification.

A swarm may be derived from Media/Representation identity plus protocol-specific context, but the exact derivation is an implementation decision and must not be assumed here.

## 8. Peer and Node Identity

A **Peer** is a network participant in an exchange.

A **Node** is a runtime hosting HiveStream semantics. Current conceptual classes include:

- ephemeral browser peer;
- durable seeder;
- possible future community/super-peer.

Peer/network identity is orthogonal to media identity:

`Peer identity ≠ Media identity ≠ Representation identity ≠ Segment identity`

A peer can possess many representations, and many peers can possess replicas of the same representation.

## 9. Origin Identity

An **Origin** is an HTTP or other upstream source from which media bytes can be acquired.

Origin identity is not canonical media identity.

The same media may be reachable from multiple origins, while an origin may provide multiple unrelated media assets. Origins are therefore acquisition/bootstrap/fallback references rather than the semantic identity authority for HiveStream media.

## 10. Canonical Object Relationships

The intended relationship graph is:

```text
Media
  └── Representation
        └── Segment
              └── Replica state on Node

Media + Representation + exchange context
  └── Swarm

Node / Peer
  └── participates in Swarm
  └── may host Replica state

Origin
  └── supplies bytes for acquisition/bootstrap/fallback
```

This graph intentionally separates **what the media is**, **which byte representation is being distributed**, **what exact units are exchanged**, and **who currently possesses verified copies**.

## 11. Identity vs. Location

A URL is a location or acquisition reference. It is not automatically an identity.

Similarly:

- an HLS playlist URL is not automatically Media identity;
- a segment URL is not automatically Segment identity;
- a WebRTC peer ID is not Media identity;
- a tracker swarm identifier is not Media identity;
- a CyTube channel name is not Media identity.

These values may participate in discovery or acquisition, but they should not silently become semantic identity keys.

## 12. Identity vs. Verification

Identity answers what object a byte or metadata record claims to represent.

Verification answers whether the received bytes satisfy the expected identity/content constraints.

Therefore:

`claimed identity ≠ verified possession`

A peer advertising a segment is not by itself evidence that the peer has valid bytes. The actual media-plane proof requires successful segment acquisition and verification.

## 13. Local Ingestion

Local media ingestion must enter the same identity model as remote media acquisition:

`Local file → Media → Representation → Segments → verified local Replica`

The source being local does not create a separate media semantic model.

## 14. CyTube Boundary

CyTube-specific identifiers remain application-level identifiers.

The intended boundary is:

`CyTube → CyTube Adapter → HiveStream Core`

A CyTube channel, playlist item, or application-specific media reference may help the adapter locate or describe media, but those identifiers must not automatically become HiveStream's canonical Media identity.

## 15. Open Decisions

This document intentionally leaves these questions open until evidence or implementation experiments justify a decision:

- exact Media identifier generation;
- exact Representation identifier generation;
- canonical Segment identifier/hash scheme;
- whether Swarm IDs are deterministic or negotiated;
- whether Replica receives a persistent local identifier;
- peer identity format and lifetime;
- how identity metadata is authenticated or signed, if needed;
- how identity migration is handled when metadata is incomplete or corrected.

These are implementation/design decisions, not reasons to collapse the identity layers.

## 16. Identity Invariants

The following are architectural invariants unless explicitly revised by a documented project decision:

1. Media identity must not depend on a single acquisition URL.
2. Representation identity must distinguish materially different byte representations.
3. Segment identity must prevent incompatible content from being trusted as the same segment.
4. Replica state is local possession/verification state, not a replacement for Media identity.
5. Swarm identity is exchange context, not a global catalog.
6. Peer identity is not media identity.
7. Origin identity is not media identity.
8. CyTube identifiers remain behind the adapter boundary.
9. Identity claims do not substitute for byte-level verification.
10. Identity decisions should be evidence-driven and reversible where practical.

## 17. Relation to Milestones

This document primarily establishes **HS-001 Identity**.

It also creates prerequisites for:

- **HS-002 Segment integrity** — segment identity and verification;
- **HS-003 Actual P2P segment transfer** — swarm/peer/segment relationships;
- **HS-004 Persistent replica** — explicit replica state;
- **HS-010 Local ingestion** — common identity model for local and remote sources;
- **HS-011 CyTube adapter** — separation between application identifiers and HiveStream identity.

## 18. Design Rule

The identity system should make it possible to answer four different questions without conflating them:

1. **What media is this?** → Media
2. **Which encoding/rendition is this?** → Representation
3. **Which exact transferable content unit is this?** → Segment
4. **Who currently has a verified copy, and in what state?** → Replica on a Node

Swarm and peer identities then describe **where and with whom exchange occurs**, rather than redefining what the media is.
