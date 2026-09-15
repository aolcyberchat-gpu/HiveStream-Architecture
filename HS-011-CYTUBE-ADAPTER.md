# HS-011 — CyTube Adapter

**Authorship:** William von Meister (Project Owner) + GPT-5.6 Luna / `LUNA-HS-001` (AI Collaborator)

**Authorship rule:** This document was created collaboratively in this project. Human decisions, direction, and requirements are attributed to William von Meister; AI-authored drafting and analysis are attributed to the named AI collaborator and its unique project author ID. Author ID identifies provenance, not technical authority.

## 1. Purpose

HS-011 defines the CyTube integration boundary for HiveStream.

CyTube is an application using HiveStream, not the owner of HiveStream's media semantics.

The intended boundary is:

`CyTube → CyTube Adapter → HiveStream Core → Distribution / ReplicaStore`

The adapter translates CyTube-specific state and events into HiveStream operations and translates HiveStream results back into application behavior.

## 2. Milestone Statement

HS-011 is successful when a reproducible CyTube integration can use HiveStream media/distribution capabilities without moving HiveStream's identity, integrity, replica, or replication-policy semantics into CyTube-specific code.

The central architectural result is:

> CyTube becomes an application adapter around HiveStream rather than a second implementation of HiveStream semantics.

## 3. Thin Adapter Principle

CyTube-specific concerns belong at the adapter boundary, including:

- channel membership;
- channel permissions;
- playlist state;
- current-media state;
- CyTube player lifecycle;
- CyTube callbacks/events;
- channel-specific configuration;
- user-facing CyTube controls.

HiveStream Core owns concerns such as:

- Media identity;
- Representation identity;
- Segment identity;
- integrity verification;
- replica state;
- persistent storage;
- P2P distribution;
- HTTP fallback;
- replication policy;
- local ingestion.

The adapter must not redefine those concepts merely to fit CyTube.

## 4. CyTube Is Not the Media Identity Authority

A CyTube channel name, playlist item ID, media URL, or CyTube player identifier is not automatically a HiveStream Media identity.

The adapter may use CyTube identifiers to locate or select application state, but HiveStream must maintain its own semantic identity model.

Conceptually:

`CyTube media reference → adapter translation → HiveStream Media/Representation`

rather than:

`CyTube media reference = HiveStream Media identity`

## 5. CyTube Event Boundary

The adapter should consume verified CyTube application events rather than reaching into HiveStream internals from arbitrary page code.

Known CyTube runtime evidence provides a useful starting point for this boundary, including callback/event handling for concepts such as:

- `changeMedia`;
- `mediaUpdate`;
- `chatMsg`;
- `playlist` / queue changes;
- current-media changes;
- permission and channel-state events.

The exact adapter event map must remain grounded in the current CyTube implementation and reverse-engineering evidence rather than assumptions about undocumented behavior.

## 6. Inbound CyTube → HiveStream

Examples of application signals that may enter HiveStream through the adapter include:

`CyTube selects media → adapter resolves media/representation → HiveStream distribution request`

`CyTube playback requires segment → adapter/player integration → HiveStream segment acquisition`

`CyTube playlist changes → adapter updates application-level selection context`

`CyTube channel state changes → adapter updates application context`

These signals should not directly mutate trusted replica state.

Replica state remains owned by HiveStream Core and its storage/distribution layers.

## 7. Outbound HiveStream → CyTube

HiveStream may provide results or events to the adapter such as:

- segment availability;
- local replica availability;
- distribution status;
- acquisition/fallback status;
- playback-ready data;
- errors;
- policy decisions relevant to application behavior.

The adapter converts those results into CyTube-compatible behavior.

HiveStream should not need to know CyTube DOM element IDs or channel-specific UI details to perform core media replication.

## 8. Player Integration Boundary

CyTube's existing player should remain replaceable from the perspective of HiveStream Core.

The desired conceptual flow is:

`CyTube player → Distribution API → segment source`

rather than:

`HiveStream Core → CyTube-specific player internals`

The adapter may initially integrate with existing CyTube playback mechanisms while a more explicit HiveStream distribution/player interface is developed.

## 9. HTTP Fallback

The CyTube integration must preserve HS-006's rule that P2P is an optimization, not a playback contract.

The application should be able to continue using a trusted HTTP-origin path when:

- no peer is available;
- peer discovery fails;
- a peer disappears;
- a peer transfer fails;
- received data fails integrity verification;
- local replica state is unavailable.

The adapter must not treat temporary P2P failure as equivalent to media identity failure.

## 10. Replica State Is Not CyTube Playlist State

CyTube playlist membership and HiveStream replica availability are different concepts.

For example:

`playlist contains media X`

does not imply:

`this browser possesses verified segments for media X`

Likewise:

`browser possesses verified replica for segment S`

does not imply:

`CyTube playlist should contain S`.

The adapter must preserve this separation.

## 11. Playback State vs Replica State

CyTube playback state may include:

- current media;
- play/pause state;
- playback position;
- synchronization state;
- player lifecycle.

HiveStream replica state includes:

- acquired;
- verified;
- persistent;
- retained;
- advertised;
- seedable;
- evictable.

These state machines may interact but must not be collapsed into one state model.

A video playing in CyTube does not automatically mean its segments are retained, advertised, or seedable.

## 12. Permissions and Trust

CyTube permissions determine what a user or channel participant may do inside CyTube.

They must not automatically become HiveStream trust authority.

For example, being a CyTube channel moderator does not inherently mean a node's media bytes bypass verification.

Likewise, a HiveStream verification result does not grant CyTube channel permissions.

The adapter may translate permission-gated UI actions into HiveStream requests, but the semantic boundaries remain separate.

## 13. Channel and Swarm Semantics

A CyTube channel can provide an application-level context for selecting or grouping media activity.

It must not automatically be treated as a global HiveStream swarm identity.

A future adapter may derive a swarm/exchange context from application state, but that mapping must be explicit and versioned rather than assumed.

The same media may legitimately participate in different application contexts.

## 14. Adapter Identity and Lifecycle

The adapter should have an explicit local application context, distinct from:

- CyTube user identity;
- CyTube channel identity;
- HiveStream network peer identity;
- HiveStream Media identity;
- browser/profile node identity from HS-009.

Lifecycle events should be observable, including:

- adapter initialization;
- CyTube channel join/leave;
- media selection;
- playback start/stop;
- HiveStream initialization;
- peer connection/disconnection;
- adapter shutdown.

## 15. Reverse-Engineering Evidence

The existing CyTube research work should be treated as evidence for adapter implementation, not as a license to assume undocumented APIs.

Known evidence includes the existence of CyTube callback registration and runtime callback names, plus DOM/player/channel structures documented in the project research repositories.

Before depending on a specific callback, global, socket event, or DOM element, the implementation should identify the corresponding evidence source and version/context.

If behavior is inferred rather than directly observed, it should be labeled as an inference and tested before becoming a canonical dependency.

## 16. Minimal Experimental Adapter

The first CyTube adapter proof should remain deliberately small:

1. Initialize a HiveStream instance from a CyTube page/application context.
2. Observe a known CyTube media-selection event.
3. Resolve that media into HiveStream Media/Representation context.
4. Request one known segment through the HiveStream Distribution API.
5. Allow HiveStream to use P2P when available and HTTP fallback when necessary.
6. Verify the resulting segment through the normal integrity boundary.
7. Expose the result back to the adapter/player integration.
8. Record provenance and adapter lifecycle telemetry.

This experiment should prove the boundary, not attempt to replace CyTube wholesale.

## 17. Telemetry Requirements

Adapter telemetry should distinguish at least:

- CyTube event/context;
- adapter instance/session;
- HiveStream node identity;
- Media identity;
- Representation identity;
- Segment identity;
- acquisition source;
- P2P vs HTTP path;
- verification result;
- replica state;
- playback/application state;
- failure reason.

The same segment should therefore be traceable from an application request through acquisition and verification without conflating application and network identities.

## 18. Failure Cases

The adapter should explicitly handle:

- CyTube event unavailable or changed;
- media reference cannot be resolved;
- unsupported representation;
- HiveStream initialization failure;
- no P2P peer;
- P2P transfer failure;
- HTTP fallback failure;
- integrity verification failure;
- replica storage failure;
- CyTube player rejection;
- adapter lifecycle interruption;
- stale application state.

A CyTube-side failure must not cause invalid media data to become trusted HiveStream state.

## 19. Acceptance Criteria

HS-011 is established when a reproducible experiment demonstrates:

- [ ] CyTube can initialize the adapter.
- [ ] A known CyTube media event reaches the adapter.
- [ ] The adapter maps application media context into HiveStream semantics.
- [ ] HiveStream can request a known Segment without CyTube owning Segment identity.
- [ ] P2P and HTTP fallback remain behind the HiveStream distribution boundary.
- [ ] Segment integrity verification remains mandatory.
- [ ] Replica state remains distinct from CyTube playlist/player state.
- [ ] CyTube permissions do not bypass HiveStream verification.
- [ ] Adapter and HiveStream identities remain distinguishable in telemetry.
- [ ] A failure at the CyTube layer cannot create a trusted invalid replica.

## 20. What This Milestone Does Not Prove

HS-011 does not establish:

- complete replacement of the CyTube player;
- universal CyTube-version compatibility;
- complete playlist synchronization;
- global HiveStream swarm discovery through CyTube;
- advanced playback synchronization;
- CyTube-independent signaling infrastructure;
- permanent browser execution;
- malicious-peer detection;
- optimal replication policy.

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
- **HS-011:** CyTube adapter.

HS-011 is the application-integration boundary: the architecture should now demonstrate that the preceding HiveStream capabilities can be consumed by CyTube without allowing CyTube-specific assumptions to redefine the core.

## 22. Next Milestone

- **HS-012:** Higher-level synchronization

## 23. Design Rule

> CyTube is an application of HiveStream, not the definition of HiveStream; the adapter translates CyTube state into HiveStream operations while preserving independent identity, integrity, replica, distribution, and policy semantics.
