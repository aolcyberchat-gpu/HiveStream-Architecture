# HS-007 — Durable Seeder Proof

**Authorship:** William von Meister (Project Owner) + GPT-5.6 Luna / `LUNA-HS-001` (AI Collaborator)

**Authorship rule:** This document was created collaboratively in this project. Human decisions, direction, and requirements are attributed to William von Meister; AI-authored drafting and analysis are attributed to the named AI collaborator and its unique project author ID. Author ID identifies provenance, not technical authority.

## 1. Purpose

HS-007 establishes the first evidence that HiveStream can operate a node whose media replicas are intentionally retained for continued service rather than existing only as short-lived playback state.

The milestone focuses on the durable-seeder role: a node that possesses verified media segments, retains them across normal application lifecycle interruptions, and can subsequently serve those segments to another peer.

## 2. Milestone Statement

HS-007 is successful when a designated seeder:

`acquires → verifies → persists → survives application restart → retrieves → serves a verified segment to another peer`

The important distinction is that the seeder's availability comes from retained local replica state rather than requiring reacquisition from the media origin immediately before the peer transfer.

## 3. What “Durable” Means Here

Durable does not mean permanent.

For HS-007, durable means that the node is intentionally configured or designated to retain a verified replica beyond a single playback/session lifecycle and can recover that replica after a normal application restart or equivalent context loss.

Browser storage may still be subject to quota, eviction, user deletion, browser policy, or storage failure.

Therefore:

`durable seeder ≠ guaranteed permanent storage`

## 4. Seeder Role

A durable seeder is a node with stronger availability expectations than an ordinary ephemeral browser peer.

Conceptually:

`ephemeral peer → primarily playback + opportunistic retention`

`durable seeder → intentional retention + continued serving`

Both roles use the same Media, Representation, Segment, Replica, verification, and transfer semantics.

The difference is operational policy and expected availability, not a second media identity model.

## 5. Reference Flow

Initial population:

`HTTP/P2P acquisition → verify → persist → mark retained/seedable`

Restart:

`application restart → open ReplicaStore → recover metadata → retrieve retained Segment`

Serving:

`peer requests retained Segment → seeder reads local replica → sends bytes → receiver verifies → receiver records trusted replica`

The origin should not need to supply the segment for the seeder's serving path when the retained replica is valid.

## 6. Relationship to HS-005

HS-005 proves local replica reuse after reload and origin unavailability.

HS-007 extends that property into a service role:

`persistent replica → restart → retained replica → serve another peer`

The new proof is therefore not merely that storage survives reload. It is that retained storage can become an active source for another node.

## 7. Origin Independence

The strongest HS-007 experiment should make the origin unavailable after the seeder has populated its retained replica.

Then:

`Seeder retained Segment S → origin unavailable → peer requests S → seeder serves S`

This distinguishes durable seeding from a node that simply re-downloads the segment whenever another peer asks for it.

If the origin remains available during the test, telemetry must still establish that the bytes delivered by the seeder came from its local retained replica rather than from a fresh origin request.

## 8. Provenance Requirements

The seeder should record enough telemetry to establish:

- Media identity;
- Representation identity;
- Segment identity;
- replica state;
- persistent storage location/class;
- verification state;
- retention/seed eligibility;
- application restart or reinitialization boundary;
- local retrieval event;
- bytes served to peer;
- peer identity/session identifier where available;
- transfer duration;
- sender byte count;
- receiver byte count;
- receiver integrity result;
- origin byte count during the serving operation.

The critical distinction is:

`served from retained replica`

versus

`reacquired from origin and forwarded`.

## 9. Trust Boundary

Only verified complete segments may become seedable.

Required conceptual ordering:

`receive → assemble → verify → persist → mark retained/seedable → serve`

The following is invalid:

`receive → persist partial data → advertise as seedable`

Likewise:

`receive → persist unverified data → serve peer`

must not be treated as a trusted seeder path.

## 10. Replica State

HS-007 introduces an important distinction among replica states:

- `verified` — integrity check succeeded;
- `retained` — policy intends to keep the replica;
- `seedable` — complete, verified, retrievable, and eligible to serve;
- `serving` — currently being supplied to a peer.

These states should not be collapsed into a single boolean.

A verified segment can exist without being retained, and a retained segment should not be seedable if it is incomplete, corrupt, unavailable, or otherwise ineligible.

## 11. Serving Semantics

The seeder should serve the exact verified Segment bytes represented by the Segment identity.

The sender must not silently transcode, reconstruct different media bytes, or substitute a different Representation while claiming to serve the requested Segment.

The receiver remains responsible for independent integrity verification.

Seeder trust does not remove the receiver's verification requirement.

## 12. Restart Test

A minimal durable-seeder experiment requires a lifecycle boundary.

Recommended sequence:

1. Seeder acquires a known Segment.
2. Seeder verifies the Segment.
3. Seeder persists the Segment.
4. Seeder marks the Segment retained/seedable.
5. Seeder is closed or reloaded.
6. Seeder reopens the persistent store.
7. Seeder proves the Segment is recovered locally.
8. Origin access is disabled or made irrelevant to the serving operation.
9. Second peer requests the Segment.
10. Seeder serves the retained bytes.
11. Receiver verifies the Segment.

The experiment should be repeatable.

## 13. Failure Cases

At minimum, test:

- retained metadata exists but bytes are missing;
- retained bytes fail integrity verification after restart;
- storage cannot be opened;
- storage read fails;
- origin unavailable and retained replica unavailable;
- seeder disconnects during upload;
- receiver gets partial bytes;
- receiver integrity verification fails;
- seeder advertises a segment that becomes unavailable;
- quota prevents additional retention;
- explicit eviction removes a previously seedable replica.

The expected result in each case should be explicit rather than silently treating the seeder as healthy.

## 14. Availability Is Not Permanence

A durable seeder improves expected availability but cannot guarantee it.

Browser-based storage can be affected by:

- quota limits;
- browser eviction;
- user deletion;
- storage permissions/policy;
- device shutdown;
- process termination;
- network interruption;
- application bugs;
- hardware failure.

Therefore the architecture should model durable seeding as a stronger node role, not as an absolute guarantee.

## 15. One Semantic Core

A durable seeder must not require a separate media identity system.

The same objects remain authoritative:

`Media → Representation → Segment → Replica`

The node role determines retention and serving behavior.

This preserves the architecture's goal of one semantic core across ephemeral browser peers, durable seeders, and future node types.

## 16. Acceptance Criteria

HS-007 is established when a reproducible experiment demonstrates:

- [ ] A known Segment is acquired by the designated seeder.
- [ ] The Segment is independently verified.
- [ ] The verified Segment is persistently retained.
- [ ] The seeder survives a defined application lifecycle interruption.
- [ ] The retained Segment is recovered after restart/reinitialization.
- [ ] The recovered Segment is independently verified before serving.
- [ ] The seeder can serve the retained Segment to another peer.
- [ ] The receiving peer verifies the transferred bytes.
- [ ] Telemetry proves the serving path used the retained replica.
- [ ] The serving operation does not require fresh origin acquisition of the Segment.
- [ ] Failure of the retained replica is surfaced rather than hidden.

## 17. What This Milestone Does Not Prove

HS-007 does not establish:

- automatic replication policy;
- optimal seeder placement;
- guaranteed 24/7 uptime;
- browser background execution guarantees;
- cross-device synchronization;
- malicious-peer detection;
- reputation systems;
- multi-tab coordination;
- CyTube integration;
- advanced playback synchronization;
- complete-media retention;
- permanent archival storage.

## 18. Relation to Earlier Milestones

- **HS-001:** identity.
- **HS-002:** segment integrity.
- **HS-003:** actual P2P segment transfer.
- **HS-004:** persistent local replica.
- **HS-005:** reuse after reload without origin availability.
- **HS-006:** peer churn and HTTP fallback.
- **HS-007:** durable seeder serving from retained local replicas.

HS-007 is the point where persistent local state becomes an intentionally serviceable distributed-media resource rather than only a playback optimization.

## 19. Next Milestones

- **HS-008:** Replication policy
- **HS-009:** Multi-tab semantics
- **HS-010:** Local ingestion
- **HS-011:** CyTube adapter
- **HS-012:** Higher-level synchronization

## 20. Design Rule

> A durable seeder must serve verified retained media from its own replica state; it must not masquerade as a durable source by reacquiring every requested segment from the origin.
