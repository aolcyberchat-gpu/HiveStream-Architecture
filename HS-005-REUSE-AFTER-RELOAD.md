# HS-005 — Reuse After Reload Without Origin Availability

**Authorship:** William von Meister (Project Owner) + GPT-5.6 Luna / `LUNA-HS-001` (AI Collaborator)

**Authorship rule:** This document was created collaboratively in this project. Human decisions, direction, and requirements are attributed to William von Meister; AI-authored drafting and analysis are attributed to the named AI collaborator and its unique project author ID. Author ID identifies provenance, not technical authority.

## 1. Purpose

HS-005 proves that a persistent HiveStream replica is operationally useful after the original application context has been destroyed and the origin is unavailable.

HS-004 proves persistence. HS-005 adds the stronger test that the persisted segment can actually be reused without reacquiring that segment from the HTTP origin.

## 2. Milestone Statement

HS-005 is successful when a browser can:

1. acquire a known segment;
2. verify it;
3. persist it as a trusted local replica;
4. terminate or reload the application;
5. make the origin unavailable for the test segment;
6. recover the segment from persistent local storage;
7. verify the recovered bytes; and
8. use the recovered segment without a fresh origin acquisition.

The experiment must distinguish local replica reuse from an accidental successful HTTP fallback.

## 3. Reference Flow

`origin available → acquire → verify → persist → reload → origin unavailable → retrieve replica → verify → use`

The critical transition is:

`origin unavailable + local verified replica present → successful local reuse`

## 4. What HS-005 Proves

HS-005 establishes that HiveStream can preserve useful media state across an application lifecycle boundary and recover it when the original acquisition source cannot provide the segment.

This is the first milestone demonstrating that persistence changes playback availability rather than merely storing data for inspection.

## 5. What Does Not Count

The following are insufficient by themselves:

- successfully writing IndexedDB data;
- successfully reloading the page while the origin remains available;
- retrieving a stored object while simultaneously downloading the same segment from HTTP;
- playback succeeding because an HTTP fallback silently supplied the segment;
- relying on browser memory or an in-memory service worker state;
- proving only that a storage record exists;
- proving only that a cached HTTP response exists without establishing HiveStream replica identity and verification.

The test must establish the source of the bytes used for the reuse operation.

## 6. Origin-Unavailability Test

The origin should be made unavailable specifically for the segment under test after persistence has been established.

Possible test mechanisms include:

- controlled network blocking;
- an intentionally unreachable test origin;
- removal or invalidation of the test resource;
- a deterministic test harness that refuses origin acquisition.

The exact mechanism is an experiment choice. The important property is that a fresh origin acquisition cannot satisfy the reuse test.

## 7. Provenance of Reused Bytes

The experiment should record enough telemetry to answer:

- Was an origin request attempted?
- Was an origin response received?
- Was a local replica lookup attempted?
- Which Media, Representation, and Segment were requested?
- Which source supplied the bytes ultimately used?
- Did the recovered bytes pass integrity verification?

If the implementation cannot distinguish local retrieval from HTTP retrieval, the experiment cannot conclusively establish HS-005.

## 8. Replica Lookup

The reuse path should conceptually be:

`requested Segment identity → ReplicaStore lookup → local bytes → integrity verification → usable segment`

A missing replica should not be confused with a failed integrity check.

A retrieved object that does not match the requested semantic identity must not be accepted merely because it is physically present in storage.

## 9. Verification on Reuse

Persistent storage does not eliminate the need for verification on retrieval.

The safe semantic sequence remains:

`retrieve → identify → verify → use`

This protects against stale metadata, corruption, implementation errors, and unexpected storage changes.

An optimization may later avoid redundant hashing when stronger invariants are established, but that is outside this milestone.

## 10. Playback Boundary

HS-005 does not require the segment to be played through the final CyTube integration.

The minimum proof may use a controlled HLS/media test harness capable of demonstrating that the recovered segment satisfies the media-plane consumer without fetching the same segment from the origin.

CyTube remains behind the adapter boundary established by the architecture.

## 11. P2P Relationship

HS-005 can be demonstrated independently of P2P.

A useful combined progression is:

`origin → verified replica A → P2P transfer → verified replica B → reload B → origin unavailable → local reuse`

However, the persistence/reuse claim should remain separately observable from the P2P transfer claim.

HS-003 proves movement between peers. HS-005 proves survival and later reuse.

## 12. Failure Cases

The experiment should exercise at least:

- replica absent;
- replica present but corrupt;
- replica identity mismatch;
- origin unavailable and replica valid;
- origin unavailable and replica absent;
- storage retrieval failure;
- origin unexpectedly reachable;
- stale or incomplete replica metadata;
- browser storage eviction before reuse.

Expected behavior must be explicit rather than inferred from whether playback happens to continue.

## 13. HTTP Fallback Boundary

Normal operation may still use HTTP fallback when no valid local replica exists:

`local replica valid → use local replica`

`local replica unavailable/invalid → attempt HTTP origin`

For the HS-005 proof, the origin must be unavailable or otherwise prevented from satisfying the test so that successful recovery demonstrates actual local reuse.

## 14. Evidence Standard

A convincing HS-005 record should contain:

1. Media, Representation, and Segment identity;
2. initial successful acquisition;
3. integrity verification result;
4. persistent-store confirmation;
5. application reload or equivalent context destruction;
6. explicit origin-unavailable condition;
7. replica lookup result;
8. bytes recovered locally;
9. integrity verification after recovery;
10. successful media use;
11. telemetry demonstrating that the origin did not provide the reused segment.

A screenshot of successful playback alone is not sufficient evidence.

## 15. Acceptance Criteria

HS-005 is established when a reproducible test demonstrates:

- [ ] A specific segment is acquired from the origin.
- [ ] The segment is verified according to HS-002.
- [ ] The verified segment is persisted according to HS-004.
- [ ] The application is reloaded or its in-memory context is destroyed.
- [ ] The origin is unavailable for the segment under test.
- [ ] The local replica is found by semantic identity.
- [ ] The recovered bytes pass integrity verification.
- [ ] The media-plane consumer successfully uses the recovered segment.
- [ ] No fresh origin response supplies the reused segment.
- [ ] Missing, corrupt, or mismatched replicas are rejected rather than treated as trusted data.

## 16. What This Milestone Does Not Prove

HS-005 does not establish:

- peer-to-peer transfer by itself;
- automatic replication policy;
- durable seeder operation;
- cross-device replication;
- guaranteed browser persistence;
- complete-media availability;
- multi-tab coordination;
- CyTube integration;
- advanced playback synchronization.

## 17. Relation to Earlier Milestones

- **HS-001:** defines identity.
- **HS-002:** defines segment integrity.
- **HS-003:** proves actual P2P segment transfer.
- **HS-004:** proves persistent local replica storage.
- **HS-005:** proves persistent replica reuse after reload without origin availability.

Together, HS-001 through HS-005 establish the basic identity, integrity, movement, persistence, and reuse chain.

## 18. Next Milestones

- **HS-006:** Peer churn and HTTP fallback
- **HS-007:** Durable seeder proof
- **HS-008:** Replication policy
- **HS-009:** Multi-tab semantics
- **HS-010:** Local ingestion

## 19. Design Rule

> HiveStream must be able to prove that a persisted replica can replace origin acquisition when the origin is unavailable; otherwise persistence has not yet demonstrated distributed-media value.
