# Storage

**Authorship:** William von Meister (Project Owner) + GPT-5.6 Luna / `LUNA-HS-001` (AI Collaborator)

**Authorship rule:** This document was created collaboratively in this project. Human decisions, direction, and requirements are attributed to William von Meister; AI-authored drafting and analysis are attributed to the named AI collaborator and its unique project author ID. Author ID identifies provenance, not technical authority.

## Purpose

Storage gives HiveStream a persistent local memory of verified media segments.

## ReplicaStore boundary

All persistent media storage should sit behind a `ReplicaStore` abstraction. Higher layers should not depend directly on IndexedDB, OPFS, filesystem APIs, or a particular database schema.

Conceptual operations include:

```text
putVerified(segment)
get(segmentId)
has(segmentId)
getMetadata(segmentId)
markRetained(segmentId)
markEvictable(segmentId)
delete(segmentId)
listCandidates(policy)
```

The exact interface should be derived from implementation needs rather than prematurely frozen.

## Initial backend

IndexedDB is the initial expected backend because it is broadly available to browser applications and can hold structured metadata alongside segment data.

OPFS is a later optimization candidate for high-volume byte storage. Moving to OPFS must not change media identity, integrity semantics, or replication behavior.

## Atomicity

A segment should not become visible as a trusted persistent replica before its verification result is known.

Conceptually:

```text
receive → verify → persist trusted record
```

If persistence fails after verification, the segment remains unavailable as durable local replica state even though the bytes may still exist in memory or another temporary buffer.

## Quota

Storage capacity is browser-controlled and variable. HiveStream must discover available storage rather than assume a universal quota.

A storage manager should distinguish:

- bytes currently stored,
- estimated available capacity,
- bytes reserved for active work,
- bytes eligible for eviction.

## Eviction

Eviction is a replication-policy operation, not merely a database cleanup task. Storage should expose enough metadata for policy to make informed decisions.

Possible factors include playback demand, rarity, peer availability, durable-seeder coverage, recency, and storage pressure.

## Reload semantics

Persistence exists specifically so a later session can reuse verified data without reacquiring it from the original source. The implementation must therefore make identity and verification metadata durable alongside the bytes needed for reuse.

## Integrity

Storage must never weaken segment verification. A segment retrieved from local storage is trusted because it was previously verified under the applicable identity/integrity rules—not merely because it came from a local database.

> **Design rule:** Storage is an implementation detail behind ReplicaStore; persistence must preserve the semantic guarantees of the Replica Model across sessions.
