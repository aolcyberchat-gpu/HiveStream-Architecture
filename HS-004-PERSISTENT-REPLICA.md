# HS-004 — Persistent Replica

**Authorship:** William von Meister (Project Owner) + GPT-5.6 Luna / `LUNA-HS-001` (AI Collaborator)

**Authorship rule:** This document was created collaboratively in this project. Human decisions, direction, and requirements are attributed to William von Meister; AI-authored drafting and analysis are attributed to the named AI collaborator and its unique project author ID. Author ID identifies provenance, not technical authority.

## 1. Purpose

HS-004 defines the milestone in which a verified HiveStream media segment is stored as persistent local replica data rather than existing only as transient playback state.

This milestone follows HS-003, which proves actual verified P2P segment transfer. HS-004 adds durable local retention without prematurely requiring complete replication policy, durable seeder infrastructure, or application integration.

## 2. Milestone Statement

HS-004 is successful when a browser can:

1. acquire a known media segment;
2. verify the segment according to HS-002;
3. store the verified segment in browser-persistent storage;
4. associate the stored bytes with the correct Media, Representation, and Segment identity;
5. retrieve the stored segment after the original in-memory playback context is gone; and
6. distinguish trusted persistent replica data from unverified, partial, stale, or failed data.

The storage operation must not silently convert merely received bytes into trusted replica state.

## 3. Persistence Boundary

The architectural boundary is:

`acquire → verify → persist → retrieve → verify/use`

Persistence is a state transition, not merely a write to a browser storage API.

A successful `put()` or equivalent storage operation does not by itself prove that the stored object is a valid HiveStream replica.

## 4. Replica Identity

Persistent data must remain associated with the semantic identity established by HS-001:

`Media → Representation → Segment → Replica state`

A physical storage key is an implementation detail and must not become the sole semantic identity of the media object.

The implementation should be capable of answering:

- Which Media does this segment belong to?
- Which Representation?
- Which Segment?
- Has the segment been verified?
- Is the stored copy complete?
- Is it retained and eligible for reuse?

## 5. Required Replica States

HS-004 should distinguish at least these concepts:

- **acquired** — bytes have been obtained;
- **verified** — integrity verification succeeded;
- **persistent** — verified data was successfully committed to persistent storage;
- **playback-needed** — playback currently benefits from the replica;
- **retained** — policy currently permits keeping the replica;
- **advertised** — the replica may be offered to peers;
- **seedable** — the local node can serve the segment;
- **evictable** — policy permits removal.

These states are related but are not interchangeable.

In particular:

`persistent ≠ verified`

and

`persistent ≠ advertised`.

A corrupted or unverified object must not become a trusted replica merely because it exists in IndexedDB, OPFS, or another storage backend.

## 6. Storage Abstraction

HiveStream should expose a logical `ReplicaStore` boundary rather than coupling the semantic core directly to one browser storage technology.

The initial implementation may use IndexedDB because it provides broadly available structured persistent browser storage.

OPFS remains a later candidate for workloads that benefit from direct byte-oriented file access or different storage characteristics.

The architecture should therefore resemble:

`HiveStream Core → ReplicaStore → physical storage backend`

rather than:

`HiveStream Core → IndexedDB-specific semantics`.

## 7. Minimal ReplicaStore Capability

The first persistent implementation should prove only the operations needed for the milestone. A conceptual interface is sufficient at this stage:

- store a verified segment;
- determine whether a segment exists;
- retrieve a segment by semantic identity;
- remove a segment;
- enumerate locally stored segment identities;
- report enough metadata to determine replica state.

Exact method names, schema, serialization format, and transaction design remain implementation decisions.

## 8. Atomicity and Partial Writes

The implementation must account for interrupted writes.

A storage record must not be advertised or treated as a complete trusted replica if the write was interrupted or only partially committed.

Where the backend permits it, metadata and segment bytes should be committed in a way that allows the implementation to distinguish a complete verified object from an incomplete write.

The exact transaction strategy is implementation-specific.

## 9. Verification and Persistence Ordering

The default safe sequence is:

`receive → assemble → verify → persist → mark trusted → advertise/serve`

This ordering follows HS-002.

An implementation may optimize the physical ordering later, but it must preserve the semantic invariant that unverified data cannot enter trusted replica state.

## 10. Retrieval After Context Loss

The defining experiment should include a lifecycle boundary.

For example:

`Browser loads segment → verifies → persists → playback context ends → application reloads/reinitializes → ReplicaStore retrieves segment → identity and integrity are checked → segment is usable`

This distinguishes persistent replica storage from an ordinary memory cache.

A browser reload is a useful first test because it removes the in-memory JavaScript state while leaving origin-scoped persistent browser storage available, subject to normal browser storage behavior.

## 11. Storage Quota and Eviction

Browser storage is not equivalent to unlimited disk storage.

HS-004 therefore does not claim permanent retention merely because a segment was successfully persisted.

The implementation must be prepared for:

- quota exhaustion;
- storage write failure;
- browser-managed eviction;
- unavailable storage;
- explicit application eviction.

The replica model should represent the difference between “previously persisted” and “currently present and retrievable.”

Exact quota policy belongs to later replication-policy work.

## 12. Persistent Replica vs Cache

A cache generally exists to accelerate a local consumer and may be discarded without changing the system's semantic model.

A HiveStream replica is intentionally stronger: it is identified media state that may later be reused or served to another peer.

Therefore persistence is an enabling mechanism for replication, not merely a playback optimization.

This distinction does not require every stored segment to be retained forever or immediately seeded.

## 13. P2P Relationship

HS-004 should be compatible with the HS-003 transfer path.

The preferred progression is:

`Browser A verified segment → P2P transfer → Browser B verifies → Browser B persists → Browser B can later retrieve the replica`

However, HS-004 may initially use HTTP acquisition to isolate and prove persistence before combining the experiment with P2P.

Separating these tests can make failures easier to diagnose.

## 14. Advertisement Rule

A node should not advertise a segment as available for peer service merely because bytes were once received.

The safe conceptual condition is:

`complete + verified + retrievable + eligible-for-service`

Only then should a replica become available to the distribution layer.

Whether every persistent replica is immediately eligible for service remains a later policy decision.

## 15. Failure Cases

At minimum, the implementation should eventually exercise:

- verification failure before storage;
- storage write failure;
- interrupted or incomplete write;
- retrieval failure;
- retrieved bytes failing integrity verification;
- quota exhaustion;
- explicit deletion;
- browser eviction or loss of persistent data;
- stale metadata or identity mismatch.

A failure should leave the replica state untrusted rather than silently promoting it.

## 16. Evidence Standard

A successful HS-004 experiment should preserve evidence showing:

1. a specific Media, Representation, and Segment;
2. successful integrity verification;
3. successful persistent storage;
4. termination or reload of the original in-memory application state;
5. successful retrieval from the persistent store;
6. identity matching;
7. integrity matching on retrieval;
8. successful use of the recovered segment;
9. correct behavior when the stored object is unavailable or invalid.

The experiment should make it possible to distinguish persistent retrieval from an accidental second HTTP acquisition.

## 17. What This Milestone Does Not Prove

HS-004 does not establish:

- automatic replication policy;
- reliable peer seeding;
- durable seeder operation;
- cross-device persistence;
- guaranteed browser storage permanence;
- complete-media replication;
- multi-tab coordination;
- CyTube integration;
- advanced synchronization.

Those belong to later milestones.

## 18. Acceptance Criteria

HS-004 is established when a reproducible experiment demonstrates:

- [ ] A known segment is acquired.
- [ ] The segment passes HS-002 integrity verification.
- [ ] The verified segment is stored through the `ReplicaStore` abstraction.
- [ ] The stored object has correct Media, Representation, and Segment identity.
- [ ] The original in-memory context is terminated or reinitialized.
- [ ] The segment is retrieved from persistent local storage.
- [ ] Retrieved data passes integrity verification.
- [ ] The recovered segment is usable without requiring a fresh origin download for the retrieval test.
- [ ] Invalid, missing, or failed storage states are not treated as trusted replica data.
- [ ] Storage failure and quota/error conditions are observable.

## 19. Next Milestones

- **HS-005:** Reuse after reload without origin availability
- **HS-006:** Peer churn and HTTP fallback
- **HS-007:** Durable seeder proof
- **HS-008:** Replication policy

## 20. Design Rule

> HiveStream must treat persistence as a verified replica-state transition, not merely as bytes written to browser storage.
