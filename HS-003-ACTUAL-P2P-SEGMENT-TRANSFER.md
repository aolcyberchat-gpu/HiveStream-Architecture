# HS-003 — Actual P2P Segment Transfer

**Authorship:** William von Meister (Project Owner) + GPT-5.6 Luna / `LUNA-HS-001` (AI Collaborator)

**Authorship rule:** This document was created collaboratively in this project. Human decisions, direction, and requirements are attributed to William von Meister; AI-authored drafting and analysis are attributed to the named AI collaborator and its unique project author ID. Author ID identifies provenance, not technical authority.

## 1. Purpose

HS-003 defines the first implementation milestone that proves HiveStream can transfer actual media bytes from one browser peer to another.

This milestone is deliberately narrower than “WebRTC works,” “peers discovered each other,” or “a swarm exists.” The required proof is an actual media segment transfer that can be identified, received, verified, and measured.

## 2. Milestone Statement

HS-003 is successful only when two independent browser instances participating in the same HiveStream media context demonstrate:

1. the same Media and Representation identity;
2. a common Segment identity for a transferable media segment;
3. peer-to-peer transport between Browser A and Browser B;
4. actual transfer of that segment's media bytes over the peer connection;
5. successful segment-integrity verification as defined by HS-002;
6. evidence that Browser B can use the transferred segment as replica data; and
7. measurable evidence that bytes moved through the P2P path rather than only through HTTP.

## 3. What Does Not Count

The following are useful intermediate results but do **not** establish HS-003 by themselves:

- successful WebRTC signaling;
- successful WebRTC DataChannel establishment;
- discovery of another peer;
- shared swarm membership;
- exchanging segment IDs without media bytes;
- HTTP download followed by a claim that the peer supplied the segment;
- a library reporting that P2P is enabled;
- playback continuing while the actual source of a segment remains unproven.

The distinction is intentional: control-plane connectivity is not media-plane transfer.

## 4. Reference Flow

The target experiment is:

`Browser A → acquire/possess verified Segment S → advertise availability → Browser B requests Segment S → Browser A sends Segment S bytes → Browser B receives bytes → Browser B verifies Segment S → Browser B records trusted replica state`

HTTP may remain available as bootstrap or fallback, but the experiment must establish that the selected segment was actually supplied by Browser A.

## 5. Browser Roles

### Browser A — Seeder / Sender

Browser A must possess a verified copy of the selected segment before sending it.

Browser A should record:

- Media identity;
- Representation identity;
- Segment identity;
- segment byte length;
- verification state;
- time the segment became available for peer service;
- bytes sent to Browser B.

### Browser B — Receiver

Browser B must request or otherwise select the same segment and receive it through the P2P path.

Browser B should record:

- Media identity;
- Representation identity;
- requested Segment identity;
- bytes received from Browser A;
- transfer start/end times;
- integrity-verification result;
- resulting replica state.

## 6. Proof Boundary

The proof boundary is the point at which Browser B can distinguish:

`segment requested → segment received from peer → segment verified → segment trusted`

The experiment should make the source of the bytes observable enough to rule out an accidental HTTP-only success.

## 7. Required Measurements

At minimum, the experiment should capture:

- selected Segment ID;
- expected segment size, when known;
- received byte count;
- sender byte count;
- P2P transfer duration;
- integrity result;
- HTTP byte count for the tested segment, if measurable;
- whether Browser B retained the verified segment locally.

Exact telemetry APIs are an implementation detail and remain open.

## 8. HTTP Fallback

HTTP fallback must not be removed merely to make the P2P test pass.

The preferred experiment has two observable paths:

`P2P available → request peer segment → verify → use peer data`

and, when P2P is unavailable:

`P2P unavailable/fails → HTTP origin → verify → use origin data`

The fallback path demonstrates that P2P is an optimization/distribution path rather than the only playback dependency.

## 9. Integrity Requirement

HS-002 establishes the invariant that received bytes are not trusted until verified.

Therefore HS-003 must not treat a successful DataChannel transfer as sufficient. The receiver must perform the agreed integrity procedure before the segment becomes trusted replica data.

The exact hash algorithm and Segment-ID construction remain open unless independently established by an implementation experiment or adopted decision.

## 10. Minimal Test Environment

The first proof should use the smallest reproducible setup possible:

- two independent browser instances;
- one known HLS media source;
- one known Representation;
- one selected media Segment;
- one P2P signaling/discovery mechanism;
- one P2P data path;
- HTTP origin available for fallback;
- visible experiment logging.

The initial experiment does not require full replication policy, durable storage, multi-tab coordination, CyTube integration, or advanced synchronization.

## 11. Evidence Standard

A successful HS-003 record should preserve enough evidence to answer:

1. Which media was tested?
2. Which Representation was tested?
3. Which Segment was transferred?
4. Which browser sent it?
5. Which browser received it?
6. How many media bytes crossed the P2P path?
7. Did the received bytes pass integrity verification?
8. Did the receiver treat the segment as a trusted replica?
9. What happened when the P2P path was unavailable?

Screenshots alone are insufficient when they cannot establish byte provenance. Network telemetry, application logs, or equivalent reproducible measurements are preferred.

## 12. Failure Cases to Test

At least these cases should eventually be exercised:

- peer unavailable;
- peer discovered but transfer fails;
- transfer interrupted partway through;
- received bytes fail integrity verification;
- requested Segment is unavailable at the sender;
- HTTP fallback succeeds after P2P failure;
- HTTP fallback also fails.

A failed transfer is not necessarily a failed architecture experiment if the failure is observable and the fallback behavior is correct.

## 13. Relationship to p2p-media-loader

`p2p-media-loader` may provide the initial media-plane implementation foundation, but library-level P2P support is not itself HS-003 evidence.

HiveStream must retain enough application-level identity, verification, and telemetry boundaries to establish what was actually transferred. The Distribution API should isolate the implementation library from HiveStream semantic ownership.

## 14. Relationship to Storage

HS-003 does not require the final persistent ReplicaStore architecture.

For the milestone, Browser B may retain the verified segment in temporary or minimal local state sufficient to demonstrate that the received object is usable and identifiable.

Persistent replica durability belongs to HS-004.

## 15. Relationship to CyTube

CyTube integration is not required for HS-003.

The test should preferably run below the CyTube adapter boundary so that a successful media-transfer proof establishes HiveStream capability independently of CyTube application semantics.

CyTube integration belongs to HS-011.

## 16. Acceptance Criteria

HS-003 is considered established when a reproducible experiment demonstrates all of the following:

- [ ] Browser A and Browser B are independent peers.
- [ ] Both operate on the same Media and Representation identity.
- [ ] A specific Segment is selected for transfer.
- [ ] Browser A possesses a verified copy before serving it.
- [ ] Browser B receives actual segment media bytes from Browser A.
- [ ] The transfer is demonstrably P2P rather than HTTP-only.
- [ ] Browser B verifies the received segment successfully.
- [ ] Browser B records the segment as trusted replica data.
- [ ] Transfer measurements are captured.
- [ ] HTTP fallback remains functional when the P2P path is unavailable.

## 17. What This Milestone Proves

A successful HS-003 experiment proves the smallest important media-plane capability:

`verified media segment → peer → verified media segment`

It does **not** prove persistent distributed storage, reliable replication, durable seeding, global availability, sophisticated swarm policy, or application synchronization.

Those require later milestones.

## 18. Next Milestones

- **HS-004:** Persistent replica
- **HS-005:** Reuse after reload without origin availability
- **HS-006:** Peer churn and HTTP fallback
- **HS-007:** Durable seeder proof

## 19. Design Rule

> HiveStream must prove movement of actual verified media bytes before claiming that its P2P media plane works.
