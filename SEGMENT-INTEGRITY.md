# HiveStream Segment Integrity Model

**Authorship:** William von Meister (Project Owner) + GPT-5.6 Luna / `LUNA-HS-001` (AI Collaborator)

**Authorship rule:** This document was created collaboratively in this project. Human decisions, direction, and requirements are attributed to William von Meister; AI-authored drafting and analysis are attributed to the named AI collaborator and its unique project author ID. Author ID identifies provenance, not technical authority.

## 1. Purpose

This document defines the integrity boundary for HiveStream media segments. A segment must not become trusted replica data merely because it was received from an origin or peer.

The immediate architectural requirement is simple:

> **Acquire → identify → verify → trust → retain/serve**

Integrity is therefore part of the replica model, not an optional diagnostic feature.

## 2. Segment Definition

A HiveStream **Segment** is an exact transferable unit belonging to a specific **Representation**.

A segment may be described by metadata such as:

- representation identity;
- segment identity or sequence information;
- byte length;
- media timing information when required by the representation;
- cryptographic content hash;
- acquisition/source metadata.

Sequence numbers or URLs alone are not sufficient as content identity. The same sequence position can only be treated as the same segment when the surrounding representation identity and integrity information establish that relationship.

## 3. Integrity Invariant

For any segment accepted into trusted replica state:

`segment bytes + representation context → expected identity → verification succeeds`

A failed verification MUST prevent the received bytes from being treated as a trusted replica of the expected segment.

This does not require every transport to expose the same metadata. It requires HiveStream's semantic layer to have an explicit way to determine what content is expected and whether received content satisfies that expectation.

## 4. Cryptographic Verification

A cryptographic hash is the preferred primitive for exact byte verification.

The architecture does not yet mandate a specific hash algorithm, digest encoding, or canonical segment-ID construction. Those choices should be fixed by an implementation decision supported by interoperability and browser-runtime evidence.

The important invariant is algorithm-independent:

`expected digest == digest(received bytes)`

If the comparison fails, the segment is rejected from trusted state.

## 5. Verification Timing

Verification should occur before received bytes are promoted to trusted persistent replica state.

A practical pipeline is:

`receive → buffer/assemble → hash → compare → accept/reject → persist/advertise`

For streaming playback, an implementation may need to distinguish temporary transport state from trusted replica state. Playback optimization must not silently convert unverified bytes into advertised durable content.

## 6. Origin and Peer Data

Integrity applies equally to data acquired from HTTP origins and data received from peers.

The source does not establish trust:

- HTTP origin response ≠ automatically trusted replica;
- WebRTC peer transfer ≠ automatically trusted replica;
- local ingestion ≠ automatically trusted replica until its declared identity/integrity requirements are satisfied.

The source may affect acquisition policy, diagnostics, or fallback behavior, but it does not change the semantic integrity rule.

## 7. Corrupt or Mismatched Segments

If verification fails, HiveStream should:

1. discard or quarantine the untrusted bytes;
2. mark the attempted replica as failed for that segment;
3. avoid advertising the failed bytes as available content;
4. retry through an alternate valid source when policy permits;
5. retain evidence sufficient for debugging when practical.

A single bad segment must not poison the trusted replica state for the representation.

The initial implementation does **not** require a reputation system or punitive peer scoring. Those are separate future policy questions.

## 8. Replica State Boundary

The distinction between **received** and **verified** is intentional.

Suggested conceptual states include:

`unknown → requested → received → verified → retained → advertised/seedable`

Not every implementation must expose every state publicly. The semantic distinction matters because an advertised replica represents content the node is prepared to serve as valid data.

## 9. Partial Replicas

A replica may be sparse or incomplete.

Integrity is evaluated per segment rather than requiring an entire representation to be complete before any content can be trusted.

For example:

`Representation R`

may have:

`S1 verified, S2 missing, S3 verified, S4 missing`

Such a node can truthfully advertise availability for S1 and S3 without claiming possession of the complete representation.

## 10. Advertisement Rule

A node SHOULD advertise a segment as available to peers only after the segment has reached the implementation's trusted/verified state.

This prevents a peer from propagating bytes whose identity has never been established locally.

The rule is deliberately stronger than merely advertising a successful network transfer.

## 11. Hash Scope

The initial integrity model treats the media segment's exact byte representation as the object being hashed.

Any future scheme that hashes a decoded frame, transcoded representation, or reconstructed higher-level object would be a different integrity layer and must not be silently conflated with segment-byte integrity.

## 12. Metadata Integrity

Segment bytes and their identifying metadata are related but distinct integrity concerns.

A correct byte hash can establish that bytes match an expected digest, but it does not by itself prove that external metadata describing timing, ordering, codec, or playlist semantics is correct.

Those higher-level consistency checks belong to representation and playlist validation rather than the basic byte-integrity primitive.

## 13. Trust Boundary

The trust boundary is crossed when HiveStream has sufficient evidence to treat a received segment as the expected segment.

Conceptually:

`untrusted transport data → verification boundary → trusted replica data`

Transport encryption, signaling authentication, peer identity, and application authorization may provide additional security properties. None replaces content-integrity verification.

## 14. Failure and Fallback

Integrity failure should integrate with the existing fallback architecture.

If a peer supplies invalid data, the client can request the same segment from another peer or the HTTP origin when available.

The intended behavior is therefore:

`P2P attempt → verify → reject if invalid → alternate P2P/HTTP source → verify → retain`

P2P remains an optimization; HTTP remains a viable bootstrap/fallback path.

## 15. Evidence Requirements

The first implementation milestone should demonstrate at least:

- a known representation and expected segment identity;
- successful acquisition of segment bytes;
- successful integrity verification;
- persistence or trusted in-memory retention after verification;
- rejection of deliberately altered bytes;
- no advertisement of a deliberately altered segment as valid data.

The two-browser P2P milestone should additionally demonstrate that a segment received from a peer is verified before becoming trusted local replica data.

## 16. Open Implementation Decisions

The following remain intentionally open until implementation evidence is available:

- exact hash algorithm;
- canonical digest encoding;
- exact Segment ID construction;
- how live-HLS playlist evolution supplies expected integrity metadata;
- whether integrity metadata is externally declared, locally derived, or both;
- optimized hashing strategy for large segments;
- whether trusted playback state may temporarily precede durable verification under a narrowly defined implementation contract.

These are implementation decisions, not reasons to weaken the integrity invariant.

## 17. Milestone Relation

This document establishes **HS-002 — Segment Integrity** at the architectural level.

It directly supports:

- **HS-003:** actual P2P segment transfer;
- **HS-004:** persistent replica;
- **HS-005:** reuse after reload/origin interruption;
- **HS-006:** peer churn and HTTP fallback;
- **HS-007:** durable seeder proof;
- **HS-010:** local ingestion.

## 18. Design Rule

> **HiveStream must never confuse “received” with “verified.”**

A transport can deliver bytes. A source can claim an identity. A peer can advertise availability. None of those facts alone makes the bytes a trusted replica.

Verification is the boundary that turns acquired bytes into content HiveStream can safely retain, advertise, replicate, and reuse.
