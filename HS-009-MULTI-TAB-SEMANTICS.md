# HS-009 — Multi-Tab Semantics

**Authorship:** William von Meister (Project Owner) + GPT-5.6 Luna / `LUNA-HS-001` (AI Collaborator)

**Authorship rule:** This document was created collaboratively in this project. Human decisions, direction, and requirements are attributed to William von Meister; AI-authored drafting and analysis are attributed to the named AI collaborator and its unique project author ID. Author ID identifies provenance, not technical authority.

## 1. Purpose

HS-009 defines and proves how multiple browser tabs in the same browser profile participate in HiveStream.

A browser profile may contain several tabs, windows, frames, or application instances that refer to the same media. Treating every tab as a completely independent peer can create unnecessary duplicate downloads, duplicate storage, competing playback state, and misleading peer counts.

HS-009 therefore establishes the semantic boundary between:

- browser application instances;
- browser-profile-local HiveStream state;
- media replicas;
- network peers.

## 2. Milestone Statement

HS-009 is successful when multiple tabs in the same browser context can coexist without accidentally violating HiveStream's identity, replica, storage, or replication semantics.

The first proof should establish a deliberate answer to:

> When two tabs belong to the same browser profile, are they one HiveStream node, multiple nodes, or a coordinated local group?

The initial architecture should prefer a **coordinated browser-local node** model rather than assuming every tab is an independent swarm participant.

This is an architectural direction to validate experimentally, not a claim that browser APIs guarantee it automatically.

## 3. Why Multi-Tab Semantics Matter

Without explicit semantics, two tabs may independently:

- download the same segment;
- persist duplicate data;
- advertise identical local availability as separate peers;
- compete for replication policy decisions;
- open redundant WebRTC connections;
- consume unnecessary bandwidth;
- race over storage state;
- report contradictory node status.

The problem is not merely performance. It can alter the meaning of replica ownership and peer availability.

## 4. Node Identity vs Tab Identity

A tab is an application execution context. It is not automatically a network peer identity.

The semantic distinction should be:

`Browser/Profile Node → Tab/Application Contexts → HiveStream Core`

rather than:

`Tab 1 = Peer A`

`Tab 2 = Peer B`

unless an implementation explicitly chooses and proves that behavior.

A future implementation may expose a stable local-node identity to cooperating tabs while maintaining separate tab/session identifiers for application-level activity.

## 5. Local Coordination Boundary

Multiple tabs that share the same browser profile should coordinate access to local HiveStream state when practical.

Coordination may include:

- replica ownership/availability;
- active downloads;
- segment transfer requests;
- storage writes;
- eviction decisions;
- advertisement state;
- network-peer ownership;
- replication policy inputs;
- lifecycle state.

The exact browser primitive remains an implementation decision.

A SharedWorker is one plausible mechanism, but HS-009 does not assume it is universally available or required.

Other mechanisms may include BroadcastChannel, Service Worker coordination, Web Locks, IndexedDB coordination, or an explicit application-level coordinator.

## 6. One Semantic Core

Multi-tab coordination must not create a second media model.

All tabs continue to use:

`Media → Representation → Segment → Replica`

A local coordinator merely determines how several application contexts share access to that semantic state.

## 7. Replica Ownership

A replica is local to a node/storage domain, not inherently owned by one tab.

If Tab A downloads and verifies Segment S and the shared local replica store records S as trusted, Tab B should be able to discover and use that replica according to policy without requiring another origin download solely because Tab B is a different tab.

Conceptually:

`Tab A → acquire → verify → shared ReplicaStore`

`Tab B → query → shared ReplicaStore → use`

This does not mean all tabs must share playback state.

## 8. Playback State vs Replica State

Playback state and replica state must remain separate.

For example, two tabs may legitimately watch different positions in the same media while sharing local replicas.

Therefore:

`playback position ≠ replica ownership`

`player state ≠ network peer identity`

`tab lifecycle ≠ replica lifecycle`

Closing one tab should not automatically delete a verified shared replica that remains valid for the local node.

## 9. Network Peer Semantics

The first implementation should avoid counting every tab as an independent remote peer when they are actually part of the same coordinated local node.

A peer connection should correspond to a meaningful network participant, not merely an HTML document.

If two tabs intentionally establish independent network identities in a future design, that must be explicit and observable.

## 10. Duplicate Acquisition

The coordinator should prevent unnecessary duplicate acquisition where practical.

Example:

`Tab A requests Segment S`

`Tab B requests Segment S before A completes`

The local coordinator should preferably represent this as one shared acquisition with multiple consumers rather than two independent origin/P2P transfers.

A conceptual state is:

`S: acquisition in progress → consumers {A,B}`

The exact implementation may use request coalescing, shared promises, coordinator messages, or another mechanism.

## 11. Concurrent Writes

Multiple tabs must not corrupt a shared replica through unsynchronized writes.

The storage boundary should preserve the established ordering:

`receive → assemble → verify → persist → trusted`

If two tabs acquire the same Segment concurrently, the final shared state must remain either:

- one valid verified replica; or
- an explicit failure/retry state.

It must not become a trusted state merely because multiple tabs wrote partial data.

## 12. Policy Coordination

HS-008 defines replication policy.

HS-009 defines how that policy operates when several tabs observe the same local replica state.

Without coordination, each tab could independently decide:

`retain S`

or

`evict S`

using stale local information.

A coordinated implementation should provide a consistent local view or define conflict resolution.

The policy engine remains logically separate from the coordination mechanism.

## 13. Advertisement Coordination

Advertisement should represent actual node availability rather than duplicated tab claims.

If one coordinated local node has Segment S available, peer discovery should not falsely imply that ten open tabs constitute ten independent copies merely because ten documents can access S.

Similarly, closing one tab should not withdraw node-level availability if another tab or the local replica store can still serve S.

## 14. Lifecycle Rules

The implementation should explicitly distinguish:

- tab opened;
- tab active;
- tab backgrounded;
- tab closing;
- tab crashed;
- browser process closing;
- browser restarted;
- local node still has persistent replicas.

A tab disappearing does not imply that persistent replica state disappeared.

A browser process disappearing may end active network service while persistent replicas survive, depending on the storage and lifecycle guarantees established by earlier milestones.

## 15. Minimum Viable Coordinator

The first implementation should be deliberately small.

A minimal coordinator needs to answer:

1. Who is the local HiveStream node?
2. Which tabs currently participate?
3. Which segment acquisitions are in progress?
4. Which verified replicas exist locally?
5. Which tab is consuming a given operation?
6. Which network resources are shared?
7. When may the local node advertise availability?

It does not need to solve every browser-lifecycle problem in the first experiment.

## 16. Candidate Coordination Mechanisms

Potential mechanisms include:

### SharedWorker

A SharedWorker can provide a shared JavaScript execution context to compatible tabs and is a plausible coordinator for node-level state.

### BroadcastChannel

BroadcastChannel can exchange messages between same-origin browsing contexts and may be useful for lightweight coordination.

### Web Locks

Web Locks can serialize or coordinate access to named shared resources where supported.

### Service Worker

A Service Worker can provide an origin-scoped lifecycle and coordination boundary, but its lifecycle and execution semantics differ from a continuously running process.

### IndexedDB

IndexedDB can act as a durable shared state boundary, but it should not by itself be mistaken for a complete coordination protocol.

These mechanisms are candidates. HS-009 does not declare one universally correct solution.

## 17. Minimal Experimental Scenario

A first reproducible test should use two tabs in the same browser profile.

### Test A — Shared Replica

1. Tab A acquires Segment S.
2. Tab A verifies S.
3. S is persisted into the shared ReplicaStore.
4. Tab B requests S.
5. Tab B retrieves S without reacquiring it from origin.
6. Both tabs report the same semantic Segment identity.

### Test B — Request Coalescing

1. Tab A requests Segment S.
2. Before completion, Tab B requests S.
3. Coordinator identifies one in-flight acquisition.
4. Both tabs receive the resulting verified replica.
5. Telemetry shows one acquisition rather than two unnecessary acquisitions.

### Test C — Tab Closure

1. Tab A has access to verified S.
2. Tab A closes.
3. Tab B remains active.
4. Tab B can still retrieve S from local replica state.

### Test D — Advertisement

1. Local node has verified, retrievable S.
2. Multiple tabs are open.
3. Network advertisement identifies the local node appropriately.
4. Peer count does not incorrectly multiply merely because multiple tabs exist.

## 18. Evidence Requirements

The experiment should provide telemetry for:

- local node identity;
- tab/session identity;
- Segment identity;
- acquisition request ID;
- in-flight acquisition ownership;
- storage operation;
- verification result;
- consumer count;
- network peer identity;
- advertisement state;
- tab lifecycle events.

The evidence must allow an investigator to distinguish:

`two tabs`

from

`two independent HiveStream network nodes`.

## 19. Failure Cases

At minimum, test:

- coordinator unavailable;
- one tab crashes during acquisition;
- two tabs request the same segment concurrently;
- concurrent storage writes;
- one tab closes while another consumes the replica;
- stale tab registration;
- coordinator restart;
- persistent store remains while coordinator state disappears;
- one tab attempts eviction while another actively uses the segment;
- advertisement state becomes stale;
- browser lifecycle interrupts active network service.

Failure should degrade safely toward existing playback and HTTP fallback behavior rather than corrupting trusted replica state.

## 20. Acceptance Criteria

HS-009 is established when a reproducible implementation demonstrates:

- [ ] Multiple tabs have explicit tab/session identities.
- [ ] Local node identity is distinguished from tab identity.
- [ ] Shared replica state can be accessed across participating tabs.
- [ ] A verified replica acquired by one tab can be reused by another tab without unnecessary origin reacquisition.
- [ ] Concurrent requests for the same segment can be coalesced or otherwise handled without duplicate trusted-state corruption.
- [ ] Shared writes preserve the verification boundary.
- [ ] Playback state remains independent from replica state.
- [ ] Tab closure does not incorrectly delete shared persistent replica state.
- [ ] Network advertisement does not falsely multiply one coordinated local node into multiple peers.
- [ ] Coordination failure has a defined safe fallback.
- [ ] Telemetry distinguishes tab identity, local-node identity, and remote-peer identity.

## 21. What This Milestone Does Not Prove

HS-009 does not establish:

- a universally supported browser coordination primitive;
- guaranteed background execution;
- guaranteed storage permanence;
- cross-device identity;
- multi-device synchronization;
- malicious-peer detection;
- optimal replication policy;
- CyTube integration;
- complete application lifecycle management.

## 22. Relationship to Earlier Milestones

- **HS-001:** establishes semantic identity.
- **HS-002:** establishes the verification boundary.
- **HS-003:** establishes actual P2P segment transfer.
- **HS-004:** establishes persistent replica state.
- **HS-005:** establishes reuse after reload/origin loss.
- **HS-006:** establishes peer churn and HTTP fallback.
- **HS-007:** establishes durable seeder behavior.
- **HS-008:** establishes explicit replication policy.
- **HS-009:** establishes how multiple browser contexts share one local semantic node.

## 23. Next Milestones

- **HS-010:** Local ingestion
- **HS-011:** CyTube adapter
- **HS-012:** Higher-level synchronization

## 24. Design Rule

> A browser tab is an application context, not automatically a network peer; multiple tabs sharing a browser-local HiveStream node must coordinate replica, storage, acquisition, and advertisement state without weakening identity or integrity guarantees.
