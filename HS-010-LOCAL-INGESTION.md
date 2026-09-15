# HS-010 — Local Ingestion

**Authorship:** William von Meister (Project Owner) + GPT-5.6 Luna / `LUNA-HS-001` (AI Collaborator)

**Authorship rule:** This document was created collaboratively in this project. Human decisions, direction, and requirements are attributed to William von Meister; AI-authored drafting and analysis are attributed to the named AI collaborator and its unique project author ID. Author ID identifies provenance, not technical authority.

## 1. Purpose

HS-010 establishes local media ingestion as a first-class HiveStream capability.

A user should be able to introduce media from a local source and place it into the same semantic and replica model used for remotely acquired media.

The target flow is:

`Local file/source → ingestion → Media identity → Representation → Segments → verify → persistent Replica → advertise/exchange`

Local ingestion must not create a second semantic architecture.

## 2. Milestone Statement

HS-010 is successful when a reproducible implementation can ingest a local media source, derive or assign its HiveStream media/representation identity, produce transferable segments, verify them, persist them as replica state, and make eligible segments available to the existing distribution system.

The important architectural result is:

> A locally introduced media object becomes a normal HiveStream media object rather than a special-case media type.

## 3. One Semantic Core

The same object model remains:

`Media → Representation → Segment → Replica`

The distinction is acquisition provenance, not semantic identity.

Remote acquisition may look like:

`HTTP origin → segment bytes → verification → replica`

Local ingestion may look like:

`local file → segmentation/representation processing → segment bytes → verification → replica`

After verification, the resulting replica participates in the same storage, replication, and distribution semantics.

## 4. Local Source Is Not Automatically Trusted

A local file is user-controlled input, not automatically trusted media data.

The ingestion pipeline must still establish:

- media identity;
- representation identity;
- segment boundaries;
- segment integrity;
- storage state;
- provenance.

Local origin does not bypass HS-002 verification.

The trust boundary remains:

`untrusted input → processing/segmentation → verification → trusted replica`

## 5. Acquisition Provenance

HiveStream should retain enough provenance to distinguish how a replica entered the system.

Possible provenance values include:

- HTTP origin;
- P2P peer;
- local file;
- another future ingestion mechanism.

Provenance is metadata about acquisition, not a replacement for media identity.

Two identical verified representations obtained through different acquisition paths should remain semantically compatible when their identities and segment verification agree.

## 6. Media Identity

HS-010 does not prescribe one final universal content-addressing algorithm.

The implementation must nevertheless produce a stable identity according to the identity rules established by HS-001.

Potential identity inputs may include content-derived information, representation metadata, or an explicitly declared media identity, depending on the ingestion mode.

An ingestion implementation must not silently equate:

- local filename;
- filesystem path;
- browser object URL;
- upload session ID;

with canonical Media identity.

Those are source or transport identifiers, not necessarily semantic identity.

## 7. Representation Identity

The ingestion process must preserve representation distinctions.

A locally supplied video may have attributes such as:

- codec;
- container;
- resolution;
- bitrate;
- frame rate;
- audio configuration;
- language or track information.

If two local sources represent materially different encodings, they should not be collapsed merely because a human considers them the same title.

The semantic relationship remains:

`Media → multiple Representations → Segments`

## 8. Segmentation

The local ingestion path must produce exact transferable units compatible with HiveStream's Segment abstraction.

For HLS-oriented media, this may involve producing or adopting a segmentable representation suitable for the existing media plane.

The exact segmentation/transmuxing pipeline is implementation-specific and is not fixed by HS-010.

The critical requirement is that each resulting Segment has:

- representation context;
- deterministic identity;
- exact byte content;
- integrity verification;
- sufficient metadata for retrieval and exchange.

## 9. Verification Boundary

The local path must preserve the same verification rule as remote acquisition:

`receive/create → assemble → verify → persist → advertise/serve`

A segment must not become a trusted replica merely because it was generated locally.

This protects downstream peers from propagating corrupted or incorrectly generated data.

## 10. Persistent Replica

A successful ingestion should be capable of producing persistent local replica state using the existing `ReplicaStore` abstraction.

The intended sequence is:

`local source → ingest → segment → verify → persist → policy evaluation`

Storage implementation remains behind the storage abstraction established by HS-004.

The ingestion milestone therefore does not require a new storage subsystem.

## 11. Replication Policy Interaction

HS-008 remains authoritative for retention and serving decisions.

Local ingestion should not automatically mean:

`ingested = retain forever`

Instead:

`verified local replica → replication policy → retain / advertise / seed / evict`

A user may eventually be offered explicit pinning or retention controls, but those are policy inputs rather than a new identity category.

## 12. Distribution Interaction

Once a local representation produces verified segments, existing distribution mechanisms should be able to treat those segments like any other eligible replica.

Conceptually:

`Local ingestion → ReplicaStore → Distribution API → peer`

A second media-transfer architecture should not be introduced solely for locally ingested content.

## 13. Playback Interaction

Playback is an important consumer of locally ingested media, but it is not the definition of successful ingestion.

A useful implementation should be able to demonstrate:

`local source → verified replica → playback`

and, separately:

`local source → verified replica → peer request → peer transfer`

The second flow demonstrates that locally introduced media participates in cooperative distribution rather than remaining trapped inside one application's player.

## 14. Minimal Experimental Implementation

The first implementation should avoid attempting to solve every media-format problem.

A narrow proof can use a known browser-compatible local media format and a deterministic ingestion path.

For example:

1. Select a local media file.
2. Read its bytes through the browser's file APIs.
3. Establish Media/Representation metadata.
4. Produce a known set of transferable segments.
5. Verify each segment.
6. Persist verified segments.
7. Record local-ingestion provenance.
8. Evaluate replication policy.
9. Make eligible segments available to an existing distribution path.
10. Independently verify any peer-received segment.

The exact media parser/transmuxer is an implementation decision.

## 15. Evidence Requirements

A convincing HS-010 experiment should show more than a local video playing.

At minimum it should establish:

- the local source was actually ingested;
- a Media identity was established;
- a Representation identity was established;
- transferable Segments were produced;
- segments passed integrity verification;
- verified replicas were persisted;
- local-ingestion provenance was recorded;
- policy evaluated the replicas;
- at least one eligible segment could be retrieved;
- ideally, another browser could receive and independently verify an ingested segment.

Playback alone is insufficient evidence because a browser can play a local file without creating a HiveStream replica.

## 16. Failure Cases

The implementation should explicitly handle:

- unsupported media format;
- unreadable file;
- interrupted read;
- segmentation failure;
- malformed metadata;
- verification failure;
- persistent-storage failure;
- insufficient storage;
- duplicate identity with conflicting representation metadata;
- policy rejection;
- peer transfer failure after ingestion.

A failed ingestion must not leave incomplete data advertised as a trusted replica.

## 17. Duplicate and Reuse Semantics

If the same semantic media/representation is ingested more than once, the system should be able to recognize compatible existing replica state rather than blindly treating every upload as a new media object.

The exact deduplication algorithm remains open.

The important invariant is:

`source instance identity ≠ media identity`

Two different local files may be distinct source instances while producing compatible semantic media/representation data.

## 18. Security and Trust Boundary

Local ingestion expands the set of inputs entering HiveStream.

The implementation should therefore avoid assuming that locally supplied metadata is authoritative merely because the user supplied it.

Future work may address malicious files, resource exhaustion, parser vulnerabilities, and sandbox boundaries.

HS-010's immediate security requirement is narrower:

> No locally generated or locally read segment bypasses the normal verification and trusted-replica boundary.

## 19. Acceptance Criteria

HS-010 is established when a reproducible experiment demonstrates:

- [ ] A local media source can enter HiveStream through an explicit ingestion path.
- [ ] Media identity is established independently of filename/path/object URL.
- [ ] Representation identity is established.
- [ ] Transferable Segments are produced.
- [ ] Segments pass the established integrity boundary.
- [ ] Verified segments become persistent replica state.
- [ ] Local-ingestion provenance is recorded.
- [ ] HS-008 policy evaluates resulting replicas.
- [ ] Existing distribution semantics can use eligible ingested replicas.
- [ ] A peer can, ideally, receive and independently verify an ingested segment.
- [ ] Failed or incomplete ingestion cannot be advertised as trusted replica state.

## 20. What This Milestone Does Not Prove

HS-010 does not establish:

- support for every media format;
- automatic transcoding of arbitrary files;
- universal content-addressing;
- perfect deduplication;
- malicious-file protection beyond the stated verification boundary;
- permanent archival;
- global media indexing;
- multi-tab coordination beyond HS-009;
- CyTube integration;
- advanced playback synchronization.

## 21. Relation to Earlier Milestones

- **HS-001:** identity.
- **HS-002:** segment integrity.
- **HS-003:** actual P2P segment transfer.
- **HS-004:** persistent local replica.
- **HS-005:** reuse after reload without origin availability.
- **HS-006:** peer churn and HTTP fallback.
- **HS-007:** durable seeder serving retained replicas.
- **HS-008:** replication policy.
- **HS-009:** multi-tab semantics.
- **HS-010:** local ingestion.

HS-010 proves that HiveStream's media/replica architecture is not inherently dependent on a remote HTTP origin.

## 22. Next Milestones

- **HS-011:** CyTube adapter
- **HS-012:** Higher-level synchronization

## 23. Design Rule

> Locally introduced media must enter the same verified Media → Representation → Segment → Replica pipeline as remotely acquired media; local origin changes provenance, not the semantic model.
