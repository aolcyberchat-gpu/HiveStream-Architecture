# HS-008 — Replication Policy

**Authorship:** William von Meister (Project Owner) + GPT-5.6 Luna / `LUNA-HS-001` (AI Collaborator)

**Authorship rule:** This document was created collaboratively in this project. Human decisions, direction, and requirements are attributed to William von Meister; AI-authored drafting and analysis are attributed to the named AI collaborator and its unique project author ID. Author ID identifies provenance, not technical authority.

## 1. Purpose

HS-008 defines and proves the policy boundary that decides what HiveStream should retain, request, advertise, seed, or evict.

Earlier milestones establish that replicas can be verified, persisted, reused, transferred, and served by a durable node. HS-008 addresses the next question:

> Given limited storage and changing peer conditions, why should a particular replica be retained or discarded?

Replication policy must remain separate from media identity, transport, and low-level storage mechanics.

## 2. Milestone Statement

HS-008 is successful when a reproducible implementation demonstrates that replica-management decisions are made by an explicit policy layer using observable inputs and producing explicit actions, while preserving the integrity and identity guarantees of HS-001 through HS-007.

Conceptually:

`Replica state + policy inputs → replication decision → action`

Possible actions include:

- retain;
- release/evict;
- prefetch;
- advertise;
- seed;
- decline acquisition;
- request another replica.

The exact policy algorithm is intentionally not fixed by this milestone.

## 3. Why a Policy Layer Exists

Storage is finite and peer availability changes.

A browser cannot safely assume that every acquired segment should remain forever. Conversely, immediately deleting every segment after playback destroys the cooperative-replication objective.

Policy therefore mediates between:

`media demand`

and

`available local storage / network resources`.

The policy should optimize availability subject to resource constraints without changing semantic media identity.

## 4. Policy Is Not Identity

Replication policy must never redefine what a Media, Representation, or Segment is.

The semantic chain remains:

`Media → Representation → Segment → Replica`

Policy operates on replica state and environmental conditions.

For example, policy may decide:

`retain Segment S`

but it does not decide that Segment S is a different media object because it was retained by a particular peer.

## 5. Policy Is Not Transport

Replication policy must also remain independent of whether bytes arrived through:

- HTTP;
- WebRTC/P2P;
- local ingestion;
- another future distribution mechanism.

A verified Segment has the same semantic identity regardless of acquisition transport.

Transport reports capabilities and outcomes; policy decides what to do with the resulting replica.

## 6. Candidate Policy Inputs

A future policy engine may consider inputs such as:

- playback position;
- likelihood of near-future playback;
- segment distance from the playback point;
- peer demand;
- replica rarity;
- number of known alternative replicas;
- durable-seeder availability;
- local storage budget;
- current storage usage;
- estimated eviction cost;
- network conditions;
- transfer cost;
- segment size;
- representation bitrate;
- whether the segment is complete and verified;
- whether the segment is currently being served;
- whether the replica was explicitly pinned/retained;
- application lifecycle state.

These are candidate inputs, not mandatory requirements for the first implementation.

## 7. Policy Outputs

The policy layer should produce explicit decisions rather than hidden side effects.

A conceptual decision object may contain:

`action + target replica/segment + reason + priority + expiry/reevaluation information`

Examples:

`retain(Segment S, reason=rare, priority=high)`

`prefetch(Segment S, reason=imminent playback)`

`advertise(Segment S, reason=complete+verified+eligible)`

`evict(Segment S, reason=storage pressure)`

The exact object schema remains an implementation decision.

## 8. Required State Boundaries

Policy must distinguish at least:

- acquired;
- verified;
- persistent;
- playback-needed;
- retained;
- advertised;
- seedable;
- evictable.

A policy decision must not promote an unverified or incomplete segment into a trusted retained/seedable state.

The safe ordering remains:

`receive → assemble → verify → persist → policy evaluation → advertise/seed if eligible`

## 9. Rarity and Availability

Replica rarity is a useful candidate policy signal, but it must not be treated as a globally authoritative fact unless the system has evidence for that claim.

A browser may know:

- its own replicas;
- currently observed peers;
- recently advertised availability;
- tracker/discovery observations.

It may not automatically know the complete population of all replicas in existence.

Therefore policy should distinguish:

`observed availability`

from

`global availability`.

This preserves the architecture's no-global-catalog principle.

## 10. Storage Pressure

Storage pressure is a first-class policy input.

When available storage falls below an implementation-defined threshold, policy may prioritize eviction of replicas that are:

- unlikely to be requested;
- easily reacquired;
- duplicated by many peers;
- not currently needed for playback;
- not explicitly retained;
- expensive relative to their expected utility.

A replica currently being served or required for active playback should not be evicted without a defined safe transition.

## 11. Eviction Is Not Data Corruption

Intentional eviction is different from integrity failure.

Examples:

`verified → evicted`

means policy deliberately removed valid local state.

`verified → corrupt`

means the stored data no longer passes integrity verification.

These states must not be conflated because their causes and recovery behavior differ.

## 12. Advertisement Policy

A replica should be advertised as available for peer service only when it is:

- complete;
- verified;
- retrievable;
- semantically identified;
- eligible under local policy.

Advertisement is therefore an output of both replica state and policy.

A verified segment may remain intentionally private or non-seedable.

`verified ≠ automatically advertised`

## 13. Prefetch Policy

Prefetching is a policy decision rather than an unconditional storage behavior.

A policy may request future segments when evidence suggests they are likely to be needed soon.

However, speculative prefetching should respect:

- storage budget;
- network budget;
- peer/origin availability;
- representation choice;
- current playback needs;
- cancellation when predictions change.

HS-008 does not require a particular prediction algorithm.

## 14. Durable Seeder Interaction

HS-007 establishes the durable-seeder role.

HS-008 determines when a node should retain or seed material under policy.

The relationship is:

`Replication Policy → retained/seedable state → Durable Seeder behavior`

A durable seeder may have stronger retention rules than an ephemeral playback peer, but both remain instances of the same semantic model.

## 15. Policy and Failure Recovery

Policy must coexist with HS-006 fallback behavior.

A policy decision should never prevent safe fallback when the selected P2P path fails and an alternate verified source is available.

Likewise, a failed P2P attempt should not automatically cause valid replicas to be evicted.

The system should distinguish:

`transport failure`

from

`replica policy decision`.

## 16. Re-evaluation

Replication decisions should be revisable.

Examples:

`retain → later evict`

`do not retain → later retain`

`not seedable → later seedable`

`prefetch requested → cancel`

This implies that policy state should not be encoded permanently into media identity or immutable segment metadata.

The policy engine should be able to reevaluate when relevant conditions change.

## 17. Explainability

For development and evidence purposes, policy decisions should be inspectable.

A useful policy trace should answer:

- What replica was considered?
- What inputs were observed?
- What action was selected?
- Why was the action selected?
- What constraints affected the decision?
- When should the decision be reevaluated?

The implementation does not need sophisticated machine learning. A deterministic rule set is sufficient for the first proof.

## 18. Minimal Experimental Policy

The first HS-008 implementation should remain deliberately simple.

One possible deterministic policy is:

1. Always retain complete verified segments required for active playback.
2. Retain a bounded number of recently used verified segments.
3. Prefer retaining segments with observed peer demand.
4. Prefer retaining segments when few alternate replicas are observed.
5. Under storage pressure, evict the lowest-priority eligible replica.
6. Never evict active playback state without a safe replacement path.
7. Advertise only complete, verified, retrievable, policy-eligible replicas.

This is an example experimental policy, not a final HiveStream algorithm.

## 19. Evidence Requirements

A convincing HS-008 experiment should show policy decisions under changing conditions.

At minimum:

### Run A — Retention

`verified segment → policy evaluates → retain`

### Run B — Storage pressure

`multiple retained replicas → storage pressure → policy reevaluates → eligible replica evicted`

### Run C — Advertisement

`verified + complete + retrievable + eligible → advertise`

### Run D — Policy change

`replica retained → conditions change → reevaluation → different decision`

Telemetry should distinguish policy decisions from storage operations and transport events.

## 20. Acceptance Criteria

HS-008 is established when a reproducible experiment demonstrates:

- [ ] An explicit replication-policy layer exists.
- [ ] Policy consumes observable replica/environment state.
- [ ] Policy produces explicit, inspectable actions.
- [ ] Identity remains independent of policy state.
- [ ] Transport remains independent of policy logic.
- [ ] Unverified/incomplete segments cannot become trusted retained or seedable replicas.
- [ ] At least one retention decision is demonstrated.
- [ ] At least one eviction decision under a defined constraint is demonstrated.
- [ ] Advertisement eligibility is explicitly evaluated.
- [ ] Policy decisions can be reevaluated when conditions change.
- [ ] Policy traces explain why decisions occurred.
- [ ] Failure recovery remains possible when P2P acquisition fails.

## 21. What This Milestone Does Not Prove

HS-008 does not establish:

- an optimal replication algorithm;
- globally accurate rarity information;
- complete swarm knowledge;
- machine-learning prediction;
- economic incentives;
- reputation systems;
- malicious-peer detection;
- guaranteed storage permanence;
- multi-tab coordination;
- CyTube integration;
- advanced synchronization.

## 22. Relation to Earlier Milestones

- **HS-001:** identity.
- **HS-002:** segment integrity.
- **HS-003:** actual P2P segment transfer.
- **HS-004:** persistent local replica.
- **HS-005:** reuse after reload without origin availability.
- **HS-006:** peer churn and HTTP fallback.
- **HS-007:** durable seeder serving retained replicas.
- **HS-008:** explicit policy controlling retention, acquisition, advertisement, seeding, and eviction.

HS-008 turns retained replicas from a collection of implementation states into resources managed by deliberate system policy.

## 23. Next Milestones

- **HS-009:** Multi-tab semantics
- **HS-010:** Local ingestion
- **HS-011:** CyTube adapter
- **HS-012:** Higher-level synchronization

## 24. Design Rule

> HiveStream policy may decide what to retain, request, advertise, seed, or evict, but it must never redefine media identity or weaken the verification boundary.
