# HS-006 — Peer Churn and HTTP Fallback

**Authorship:** William von Meister (Project Owner) + GPT-5.6 Luna / `LUNA-HS-001` (AI Collaborator)

**Authorship rule:** This document was created collaboratively in this project. Human decisions, direction, and requirements are attributed to William von Meister; AI-authored drafting and analysis are attributed to the named AI collaborator and its unique project author ID. Author ID identifies provenance, not technical authority.

## 1. Purpose

HS-006 proves that HiveStream remains functional when a P2P peer becomes unavailable or a peer transfer fails, while preserving the integrity and identity rules established by HS-001 through HS-005.

The milestone establishes that P2P is an optimization and replication path rather than a single point of failure for media playback.

## 2. Milestone Statement

HS-006 is successful when a media segment can be requested through the P2P path, the peer becomes unavailable or the transfer fails, and HiveStream correctly falls back to another valid acquisition source without accepting invalid or incomplete data.

The primary fallback source is HTTP origin acquisition.

## 3. Reference Flow

Normal P2P path:

`request segment → peer available → peer transfer → verify → use`

Failure path:

`request segment → peer selected → peer disappears/fails → detect failure → abandon or retry safely → HTTP origin → verify → use`

Persistent local data may also participate:

`valid local replica → use locally`

`local replica unavailable → P2P attempt → HTTP fallback`

The exact source-selection policy remains implementation-specific.

## 4. What HS-006 Proves

HS-006 establishes four important properties:

1. Peer availability is not assumed to be permanent.
2. A failed peer transfer does not poison the requested segment state.
3. HTTP remains a valid bootstrap and fallback path.
4. The media consumer can continue using verified data after P2P failure.

This is a resilience milestone, not merely a networking test.

## 5. What Does Not Count

The following are insufficient by themselves:

- two peers successfully connecting;
- a WebRTC DataChannel remaining open;
- a P2P request being attempted;
- playback continuing without proving which source supplied the segment;
- a library silently downloading the segment from HTTP while reporting P2P activity;
- retrying indefinitely without a defined failure boundary;
- accepting a partial peer response as a complete segment;
- accepting corrupt peer bytes because HTTP later succeeds.

The test must establish the source and verification result of the segment ultimately used.

## 6. Peer Churn Definition

For this milestone, peer churn means that a peer capable of supplying a requested segment becomes unavailable during the acquisition lifecycle.

Examples include:

- peer closes its connection;
- browser tab is closed;
- peer loses network connectivity;
- peer leaves the swarm;
- signaling state becomes stale;
- DataChannel fails before completion;
- sender advertises availability but cannot complete transfer.

The system must treat peer availability as dynamic state.

## 7. Failure Boundary

The implementation needs an observable boundary between:

`P2P attempt → P2P failure → fallback decision`

The exact timeout, retry count, and transport error classification are implementation decisions.

However, the system must not wait forever for an unavailable peer when an alternate verified source is available.

## 8. Source Provenance

For every segment acquisition used in the HS-006 test, telemetry should identify:

- Media identity;
- Representation identity;
- Segment identity;
- selected peer, if any;
- P2P attempt start/end;
- bytes received from the peer;
- P2P transfer completion or failure;
- integrity result;
- HTTP attempt and result, if used;
- bytes received from HTTP, where measurable;
- final source used by the media consumer.

The experiment must be able to distinguish:

`P2P success`

from

`P2P failed → HTTP success`.

## 9. Partial Peer Transfers

A peer may send fewer bytes than expected before disconnecting.

Partial data must not be promoted to a complete trusted Segment.

Conceptually:

`partial peer bytes → reject as incomplete → fallback/retry → complete verified segment`

Partial data may be retained for diagnostic purposes or future optimization, but HS-006 does not require partial-transfer resume.

## 10. Integrity Boundary

All sources remain subject to HS-002.

Neither peer identity nor HTTP origin establishes content trust.

The safe path is:

`source bytes → assemble → verify → trusted segment`

If peer data fails verification, it must not be used as trusted media data merely because the peer was previously considered valid.

The implementation should then be able to attempt an alternate source.

## 11. HTTP Fallback

HTTP fallback is a first-class resilience mechanism.

The intended behavior is approximately:

`valid local replica → local use`

`otherwise → attempt P2P when useful`

`P2P unavailable/fails → HTTP origin`

`HTTP data → verify → use/persist`

This does not require P2P to be attempted for every segment. A future policy layer may decide when P2P is worthwhile.

## 12. Interaction With Persistent Replicas

A successful HTTP fallback should still pass through the normal verification and persistence path when local retention is desired:

`HTTP → verify → persist → trusted replica`

Likewise, a successful P2P transfer may become a persistent replica:

`P2P → verify → persist → trusted replica`

The source of acquisition does not change the semantic identity of the resulting replica.

## 13. Failure Cases

At minimum, the experiment should exercise:

- peer unavailable before request;
- peer disappears during transfer;
- peer sends partial data;
- peer sends invalid data;
- peer advertises a segment it no longer has;
- signaling failure;
- multiple peer failures;
- HTTP origin available after P2P failure;
- HTTP origin unavailable after P2P failure;
- valid local replica available before either network source;
- persistent replica present but corrupt;
- repeated peer failure with eventual HTTP success.

Expected behavior must be explicit for each case.

## 14. Retry Semantics

Retry behavior must not create uncontrolled request loops.

The implementation should distinguish at least:

- retrying the same peer;
- selecting another peer;
- falling back to HTTP;
- failing the segment request because no trusted source remains.

Exact retry counts and backoff strategy are not fixed by HS-006.

## 15. No Trust Escalation From Failure Recovery

Failure recovery must not weaken integrity requirements.

For example:

`bad P2P bytes → HTTP succeeds`

must result in:

`HTTP bytes verified → trusted segment`

not:

`P2P attempt occurred → segment trusted`.

Likewise, a failed peer must not automatically be classified as malicious. Transport failure, peer departure, corruption, and malicious behavior are distinct hypotheses unless additional evidence establishes otherwise.

## 16. Evidence Standard

A convincing HS-006 experiment should contain at least two runs:

### Run A — P2P success

`peer available → segment transferred → verified → used`

### Run B — P2P failure with HTTP fallback

`peer available → transfer interrupted → failure detected → HTTP acquisition → verified → used`

Telemetry should demonstrate that the second run genuinely crossed the fallback boundary.

A stronger test adds:

### Run C — No valid network peer and valid local replica

`local replica → verified → used without network acquisition`

This demonstrates interaction with HS-005.

## 17. Acceptance Criteria

HS-006 is established when a reproducible test demonstrates:

- [ ] A known Segment can be obtained successfully from a peer.
- [ ] The peer can be deliberately made unavailable or the transfer deliberately interrupted.
- [ ] The failure is detected without treating partial data as trusted.
- [ ] The system transitions to a defined fallback path.
- [ ] HTTP can supply the requested Segment when available.
- [ ] HTTP data passes integrity verification.
- [ ] The media-plane consumer can use the verified fallback data.
- [ ] Telemetry distinguishes P2P bytes from HTTP bytes.
- [ ] Peer failure does not invalidate already verified local replica state.
- [ ] When no trusted source exists, the system fails explicitly rather than pretending the segment was acquired.

## 18. What This Milestone Does Not Prove

HS-006 does not establish:

- perfect peer selection;
- optimal retry policy;
- malicious-peer detection;
- reputation systems;
- automatic replication policy;
- durable seeder operation;
- multi-tab coordination;
- CyTube integration;
- advanced synchronization;
- a requirement that every segment use P2P before HTTP.

## 19. Relation to Earlier Milestones

- **HS-001:** identity.
- **HS-002:** segment integrity.
- **HS-003:** actual P2P segment transfer.
- **HS-004:** persistent local replica.
- **HS-005:** local replica reuse after reload without origin availability.
- **HS-006:** resilience to peer failure with verified HTTP fallback.

Together, HS-001 through HS-006 establish identity, integrity, transfer, persistence, reuse, and basic distributed-media resilience.

## 20. Next Milestones

- **HS-007:** Durable seeder proof
- **HS-008:** Replication policy
- **HS-009:** Multi-tab semantics
- **HS-010:** Local ingestion
- **HS-011:** CyTube adapter

## 21. Design Rule

> HiveStream must assume that peers disappear and must preserve verified media availability through safe source switching rather than treating P2P availability as a guarantee.
