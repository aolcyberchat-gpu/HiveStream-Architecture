# Replica Model

**Authorship:** William von Meister (Project Owner) + GPT-5.6 Luna / `LUNA-HS-001` (AI Collaborator)

**Authorship rule:** This document was created collaboratively in this project. Human decisions, direction, and requirements are attributed to William von Meister; AI-authored drafting and analysis are attributed to the named AI collaborator and its unique project author ID. Author ID identifies provenance, not technical authority.

## Purpose

A Replica is HiveStream's durable, verifiable local possession of media representation data. It is more than a cache entry: it is a potential future source for other peers.

## Replica layers

A replica should distinguish:

- **discovered** — the node knows that a segment may exist.
- **requested** — the node has requested the segment.
- **received** — bytes arrived locally.
- **verified** — bytes passed the applicable integrity check.
- **retained** — policy permits the bytes to remain stored.
- **advertised** — the node is willing to report availability.
- **servable** — the node can actually retrieve and serve the verified bytes.
- **evictable** — policy allows removal.

These are state dimensions, not necessarily one mutually exclusive enum. A segment may be verified, retained, advertised, and servable simultaneously.

## Trust boundary

Unverified bytes are not trusted replica state.

The safe transition is:

```text
RECEIVED → VERIFIED → RETAINED / SERVABLE
```

An implementation may temporarily hold received bytes outside the trusted replica store while verification is pending.

## Replica record

A logical replica record should be able to associate at least:

```text
Media ID
Representation ID
Segment ID
Integrity metadata
Byte length
Verification state
Retention state
Availability/servability state
Acquisition source
First-seen / last-verified timestamps
Optional replication metadata
```

The exact database schema is an implementation decision.

## Replica ownership

A node may possess a replica without promising indefinite availability. Advertisement must therefore describe current capability, not permanent ownership.

A durable seeder is different because its retention policy explicitly aims at higher availability.

## Eviction

Eviction removes local possession; it does not invalidate the segment globally.

Before eviction, implementations should consider whether the segment is:

- currently required for playback,
- needed for an active upload,
- unusually rare among peers,
- protected by a durable-seeder policy,
- replaceable from HTTP or another peer.

Replication policy decides; the Replica Model defines the state being managed.

## Failure rules

- Corrupt or unverifiable data must not become trusted replica state.
- A failed upload must not mark a segment as served successfully.
- Losing a peer does not invalidate local verified data.
- Losing local storage does not imply global media loss.
- Stale availability advertisements must be treated as hints, not guarantees.

## Architectural boundary

The Replica Model does not define peer discovery, transport, playback synchronization, or CyTube behavior. Those systems consume replica state through explicit interfaces.

> **Design rule:** A replica is trusted local media possession that can survive beyond the request that acquired it and can become a source for future distribution.
