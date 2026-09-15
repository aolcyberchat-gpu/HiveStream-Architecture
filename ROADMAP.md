# Roadmap

**Authorship:** William von Meister (Project Owner) + GPT-5.6 Luna / `LUNA-HS-001` (AI Collaborator)

**Authorship rule:** This document was created collaboratively in this project. Human decisions, direction, and requirements are attributed to William von Meister; AI-authored drafting and analysis are attributed to the named AI collaborator and its unique project author ID. Author ID identifies provenance, not technical authority.

## Architecture sequence

The conceptual architecture is now specified through HS-012. The next stage is implementation and reproducible runtime evidence.

### Completed architecture milestones

1. HS-001 — Identity
2. HS-002 — Segment integrity
3. HS-003 — Actual P2P segment transfer
4. HS-004 — Persistent replica
5. HS-005 — Reuse after reload
6. HS-006 — Peer churn and HTTP fallback
7. HS-007 — Durable seeder proof
8. HS-008 — Replication policy
9. HS-009 — Multi-tab semantics
10. HS-010 — Local ingestion
11. HS-011 — CyTube adapter
12. HS-012 — Higher-level synchronization

“Completed” here means architecturally specified, not necessarily runtime-proven.

## Implementation phases

### Phase A — Media-plane proof

Demonstrate actual media-byte P2P transfer using the selected distribution engine, with HTTP fallback and measurable source attribution.

### Phase B — ReplicaStore

Introduce persistent verified segment storage behind a stable abstraction. Demonstrate reuse after reload.

### Phase C — Replication

Implement retention, advertisement, prefetch, seeding, and eviction policy against real replica state.

### Phase D — Durable seeder

Demonstrate a higher-availability node serving retained verified replicas across browser/session churn.

### Phase E — Multi-tab node

Coordinate tabs into one browser-local node while allowing application-specific playback state to differ.

### Phase F — Local ingestion

Import local media into the same identity/representation/segment/replica pipeline and demonstrate optional peer sharing.

### Phase G — CyTube integration

Connect CyTube through a thin adapter. Validate current media, playlist, permissions, and synchronization mappings against reverse-engineered evidence.

### Phase H — Higher-level synchronization

Implement application/playback synchronization with explicit authority, versioning, late-join behavior, reconnect handling, and separation from media replication.

## Deferred exploration

These remain candidates rather than requirements:

- WebTorrent as an additional transport,
- libp2p/Helia,
- MOQT/WebTransport-based distribution,
- OPFS-first storage,
- WebCodecs,
- sophisticated signaling,
- community/super-peer roles,
- reputation and incentive systems,
- recommendation systems,
- advanced distributed consensus.

## Exit criterion

The architecture should not expand indefinitely. New conceptual layers require a concrete unresolved problem that existing specifications cannot express. Otherwise the next work belongs in implementation, experiments, or evidence repositories.

> **Design rule:** After HS-012, progress should be measured primarily by reproducible implementation evidence, not by adding more architecture documents.
