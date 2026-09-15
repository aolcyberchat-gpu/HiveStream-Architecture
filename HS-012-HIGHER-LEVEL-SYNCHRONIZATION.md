# HS-012 — Higher-Level Synchronization

**Authorship:** William von Meister (Project Owner) + GPT-5.6 Luna / `LUNA-HS-001` (AI Collaborator)

**Authorship rule:** This document was created collaboratively in this project. Human decisions, direction, and requirements are attributed to William von Meister; AI-authored drafting and analysis are attributed to the named AI collaborator and its unique project author ID. Author ID identifies provenance, not technical authority.

## 1. Purpose

HS-012 defines synchronization above the HiveStream media-replication layer.

The purpose is to coordinate application-level playback and shared state without allowing synchronization semantics to redefine media identity, segment integrity, replica state, or distribution.

The intended relationship is:

`Application / CyTube → Sync Adapter → HiveStream Core`

where synchronization consumes HiveStream capabilities rather than becoming a second media-distribution system.

## 2. Milestone Statement

HS-012 is successful when independent application contexts can exchange and apply higher-level playback state using explicit synchronization semantics while continuing to obtain media through HiveStream's existing verified distribution path.

The architectural result is:

> Playback synchronization is a control-plane/application concern layered above cooperative media replication.

## 3. Synchronization Is Not Media Identity

Synchronization messages may identify:

- an application session;
- a media selection;
- a representation preference;
- a playback position;
- play/pause state;
- sequencing/version information;
- synchronization authority or coordination state.

These identifiers must not automatically become HiveStream Media or Segment identity.

For example:

`mediaId + position + play state`

describes application playback state, not the bytes of a media segment.

## 4. Synchronization Is Not Replica State

An application may report:

`playback position = 125 seconds`

without implying:

`segment covering 125 seconds is locally retained`.

Likewise, a node may retain verified segments for media that is not currently playing.

Synchronization therefore consumes replica/distribution information but does not own the replica state machine.

## 5. Control Plane vs Media Plane

HS-012 preserves the separation:

**Control plane:**

- media selection;
- playback commands;
- position updates;
- synchronization epochs;
- application membership;
- authority/coordination state;
- versioning and conflict handling.

**Media plane:**

- segment acquisition;
- P2P transfer;
- HTTP fallback;
- verification;
- persistence;
- serving replicas.

A synchronization message should not carry media bytes merely because the two systems are related.

## 6. CyTube Relationship

For the CyTube adapter, higher-level synchronization may correspond to concepts such as:

- current media;
- play/pause;
- playback position;
- playlist selection;
- channel/application state;
- leader or synchronization authority.

The adapter translates those concepts into a HiveStream-independent synchronization model.

CyTube-specific event names, permissions, and callbacks remain outside the core synchronization semantics.

## 7. Explicit State Model

A synchronization implementation should represent state explicitly rather than relying on incidental event order.

A useful conceptual state contains:

- `sessionId` or application-context identity;
- selected Media identity;
- selected Representation or playback variant when relevant;
- playback state;
- position/time;
- state version or epoch;
- timestamp or monotonic ordering information;
- synchronization authority/context;
- validity/lifecycle state.

The exact wire format remains an implementation decision.

## 8. Ordering and Staleness

Distributed application events can arrive late, duplicated, reordered, or after the state they describe has already changed.

The synchronization layer therefore needs explicit rules for:

- stale updates;
- duplicate updates;
- conflicting updates;
- reconnect/rejoin;
- authority changes;
- application shutdown;
- state resumption.

A message should not be accepted merely because it arrived later in wall-clock time.

A version, epoch, sequence, or equivalent ordering mechanism should provide the basis for determining whether an update is current.

## 9. Playback Position Is Not a Global Clock

A playback position is local state observed at a particular time.

Synchronization should avoid assuming that two browser clocks are perfectly aligned.

A useful protocol may communicate:

`position + observation timestamp + state version/epoch`

and let the receiving application calculate an appropriate correction.

Exact clock synchronization is not required for the first milestone.

## 10. Correction vs Command

The synchronization layer should distinguish between:

- a command, such as `play`;
- an observed state, such as `playing at 125.4s`;
- a correction, such as `seek toward 126.0s`.

This distinction becomes important when peers reconnect or when multiple updates cross in flight.

The first implementation may use a simpler command/state model, but the distinction should remain visible in the architecture.

## 11. Media Selection Boundary

When synchronization selects media, the receiving application should resolve that selection into HiveStream Media/Representation identity through the adapter/core boundary.

The synchronization protocol should not assume that a URL is sufficient semantic identity.

Conceptually:

`sync media selection → resolve Media/Representation → acquire required Segments`

This preserves the HS-001 identity model.

## 12. Availability and Readiness

A synchronized playback command does not guarantee that the receiving node already possesses the required media.

The receiver may need to:

1. resolve the selected Media/Representation;
2. inspect local verified replica state;
3. request missing segments;
4. use P2P when available;
5. use HTTP fallback when necessary;
6. verify received segments;
7. begin or correct playback when sufficient data is ready.

Therefore synchronization should distinguish:

`command received`

from:

`media ready for execution`.

## 13. Synchronization Under Peer Churn

HS-006 establishes that media delivery must survive peer churn through safe fallback.

HS-012 applies the same principle at the control layer.

If a synchronization peer disappears, the remaining application must have an explicit behavior for:

- retaining current state;
- selecting another authority;
- pausing synchronization;
- continuing independently;
- reconnecting and resynchronizing.

The disappearance of a synchronization peer must not invalidate already verified media replicas.

## 14. Multi-Tab Relationship

HS-009 established that multiple tabs may belong to one browser-local node.

Synchronization should therefore distinguish:

`Browser/Profile Node → Tab/Application Context → Sync Session`

from:

`every tab = independent network peer`.

A multi-tab implementation may coordinate application state locally while HiveStream maintains one coherent local replica/storage domain.

The exact browser coordination mechanism remains an implementation choice.

## 15. Authority and Leadership

Some applications may require an authority for shared playback state.

The synchronization layer may therefore define roles such as:

- observer;
- participant;
- coordinator/leader;
- temporarily disconnected participant.

These are application synchronization roles, not automatically HiveStream network trust roles.

A CyTube leader, for example, should not gain the ability to bypass segment verification merely by holding application authority.

## 16. Conflict Handling

If two participants issue incompatible state changes, the synchronization layer needs deterministic conflict behavior.

Possible strategies include:

- authority wins;
- explicit application policy;
- epoch/term precedence;
- latest valid version under an agreed ordering rule.

HS-012 does not mandate one universal conflict algorithm.

The first implementation should choose one simple, observable rule and document it rather than leaving conflict resolution implicit.

## 17. Reconnection and State Recovery

A reconnecting participant should not assume that missed events can be reconstructed safely from local memory alone.

A minimal recovery flow is:

`reconnect → identify session/context → obtain current authoritative state → compare version/epoch → apply current state → acquire missing media → resume synchronization`

Already verified local replicas should remain usable during this process where policy and playback permit.

## 18. Telemetry Requirements

Synchronization telemetry should distinguish at least:

- sync session/context identity;
- local node identity;
- application/tab identity;
- Media identity;
- Representation identity when relevant;
- state version/epoch;
- message type;
- send/receive time;
- applied/rejected/stale result;
- authority/role;
- local media readiness;
- correction/action taken;
- peer/network lifecycle.

This allows debugging of synchronization without confusing control messages with actual media transfer.

## 19. Minimal Experimental Implementation

The first HS-012 experiment should be intentionally narrow:

1. Start two independent application contexts.
2. Select the same Media.
3. Establish one explicit synchronization context.
4. Choose a simple authority rule.
5. Send media selection and play/pause state.
6. Send periodic playback-position observations.
7. Introduce a controlled delay or disconnect.
8. Reconnect and obtain current state.
9. Resolve required media through HiveStream distribution.
10. Verify that synchronization state and replica state remain independently observable.

A CyTube implementation may be the first concrete application of this experiment.

## 20. Evidence Requirements

A convincing HS-012 result should demonstrate:

- synchronized media selection;
- explicit playback-state exchange;
- deterministic ordering/version handling;
- stale or duplicate update handling;
- reconnection/state recovery;
- media-readiness handling;
- continued use of verified HiveStream distribution;
- separation of synchronization telemetry from media-transfer telemetry.

Simply observing two videos playing at approximately the same time is insufficient evidence.

## 21. Failure Cases

The implementation should explicitly test:

- delayed messages;
- duplicated messages;
- reordered messages;
- stale state;
- simultaneous conflicting updates;
- authority disappearance;
- participant disappearance;
- reconnect;
- missing media;
- slow media acquisition;
- P2P failure with HTTP fallback;
- invalid media data;
- multi-tab lifecycle interruption.

A synchronization failure must not weaken media integrity or trusted replica state.

## 22. Acceptance Criteria

HS-012 is established when a reproducible experiment demonstrates:

- [ ] Independent application contexts can join an explicit synchronization context.
- [ ] Media selection is represented independently from transport URLs.
- [ ] Playback state can be exchanged with explicit version/ordering semantics.
- [ ] Stale or duplicate updates are handled deterministically.
- [ ] A defined authority/conflict rule exists.
- [ ] Reconnection can recover current state.
- [ ] Media readiness is distinguished from command receipt.
- [ ] HiveStream distribution remains responsible for segment acquisition and verification.
- [ ] Replica state remains independent of playback synchronization state.
- [ ] Multi-tab/node identity remains distinguishable.
- [ ] Telemetry can trace synchronization without falsely describing control messages as media transfer.

## 23. What This Milestone Does Not Prove

HS-012 does not establish:

- perfect clock synchronization;
- frame-perfect playback synchronization;
- universal conflict resolution;
- malicious synchronization-peer detection;
- permanent network connectivity;
- global identity;
- distributed consensus;
- complete CyTube compatibility;
- optimal synchronization algorithms;
- universal browser background execution.

## 24. Relation to Earlier Milestones

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
- **HS-011:** CyTube adapter.
- **HS-012:** higher-level synchronization.

HS-012 is deliberately layered above the preceding media-replication milestones. It should not be used as justification for adding synchronization complexity before the underlying verified distribution system works.

## 25. Post-HS-012 Direction

HS-012 completes the initial architecture milestone sequence, but it does not mean the project is complete.

Future work can now be evaluated against the established boundaries rather than inventing new foundational concepts for each feature.

Potential follow-on areas include:

- stronger signaling and discovery;
- richer replication policy;
- durable/community nodes;
- improved storage backends;
- advanced playback correction;
- multiple application adapters;
- additional media formats;
- operational tooling and observability;
- security hardening;
- performance optimization.

Each should preserve the established semantic core unless evidence demonstrates that a foundational change is necessary.

## 26. Design Rule

> Higher-level synchronization coordinates application state; it must not redefine media identity, weaken segment verification, or become a substitute for HiveStream's verified media-distribution layer.
