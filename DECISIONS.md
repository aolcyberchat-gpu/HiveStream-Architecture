# Decisions

**Authorship:** William von Meister (Project Owner) + GPT-5.6 Luna / `LUNA-HS-001` (AI Collaborator)

**Authorship rule:** This document was created collaboratively in this project. Human decisions, direction, and requirements are attributed to William von Meister; AI-authored drafting and analysis are attributed to the named AI collaborator and its unique project author ID. Author ID identifies provenance, not technical authority.

## Decision record

This file records architectural decisions that constrain implementation. It is intentionally separate from experimental results and implementation code.

### D-001 — Browser-native cooperative replication

HiveStream is designed as a browser-native cooperative media replication system. P2P playback is the first practical use case; persistent distributed replicas are the larger goal.

### D-002 — Separate architecture, implementation, and evidence

The architecture repository defines the intended system. Implementation repositories contain code. Reverse-engineering/evidence repositories contain observed behavior. They should not be treated as interchangeable sources of truth.

### D-003 — One semantic core

Browser peers and future durable nodes use the same Media, Representation, Segment, Replica, and replication concepts.

### D-004 — Application-owned media identity

HiveStream owns application-level Media identity. Transport/library swarm identifiers are not automatically semantic media identifiers.

### D-005 — P2P with HTTP fallback

P2P is cooperative optimization/distribution. HTTP remains a valid bootstrap and fallback path.

### D-006 — IndexedDB first

ReplicaStore initially targets IndexedDB, with OPFS reserved as a later storage optimization.

### D-007 — No premature second distribution stack

WebTorrent and other alternative stacks remain deferred until the existing media-plane foundation has demonstrated the needed capability.

### D-008 — CyTube as adapter

CyTube-specific behavior belongs behind an adapter. Core HiveStream semantics must remain application-independent.

### D-009 — Evidence before complexity

A layer should be supported by reproducible evidence before it becomes a dependency for additional architecture.

### D-010 — Local ingestion is first-class

Local media should enter the same identity, representation, verification, storage, and replication pipeline as network media.

### D-011 — Multi-tab is a semantic requirement

One browser profile should have coherent node-level replica and peer semantics even when multiple application tabs are open. The implementation mechanism remains open.

### D-012 — Playback synchronization is separate

Higher-level playback/application synchronization must not redefine media identity, segment integrity, or replica trust.

### D-013 — Control/media separation

Control metadata coordinates state and availability; actual media bytes move through the media plane and become trusted only after verification.

## Status vocabulary

A decision may be:

- **adopted** — currently constrains architecture;
- **provisional** — selected for current implementation but intentionally revisable;
- **deferred** — explicitly postponed;
- **superseded** — replaced by a later decision.

> **Design rule:** Decisions record constraints and rationale; experiments determine whether those decisions survive contact with the runtime.
