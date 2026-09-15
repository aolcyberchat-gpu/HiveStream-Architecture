# Replication

**Authorship:** William von Meister (Project Owner) + GPT-5.6 Luna / `LUNA-HS-001` (AI Collaborator)

**Authorship rule:** This document was created collaboratively in this project. Human decisions, direction, and requirements are attributed to William von Meister; AI-authored drafting and analysis are attributed to the named AI collaborator and its unique project author ID. Author ID identifies provenance, not technical authority.

## Purpose

Replication determines which verified media a node should retain, obtain, advertise, seed, or remove.

It is distinct from playback. A node may replicate media it is not currently watching.

## ReplicationManager

A future `ReplicationManager` should consume:

- local storage state,
- playback demand,
- representation/playlist information,
- segment rarity or availability hints,
- peer availability,
- durable-seeder coverage,
- storage pressure,
- transfer cost,
- retention policy.

It should produce decisions such as retain, prefetch, advertise, seed, deprioritize, or evict.

## Rarity

Rarity is useful but must be treated as an estimate. Peer advertisements can be stale, incomplete, or malicious. A node should not discard its only verified copy merely because another peer claims availability.

## Replication priority

A reasonable future priority order is:

1. protect data required for active playback;
2. preserve verified data that is scarce or expensive to reacquire;
3. maintain explicit durable-seeder commitments;
4. opportunistically prefetch useful future segments;
5. evict low-value data under storage pressure.

This is a policy hypothesis, not a final algorithm.

## Replication versus synchronization

Replication answers **what bytes should exist on this node**. Playback synchronization answers **what application state the user should currently observe**. They must remain separate.

## Advertisement

Availability advertisement should expose capability, not ownership or an indefinite guarantee. An advertised segment may disappear because of eviction, quota pressure, browser shutdown, or peer churn.

## Network behavior

Replication must tolerate:

- duplicated requests,
- delayed messages,
- peer disappearance,
- stale availability,
- HTTP fallback,
- partial progress,
- interrupted transfers.

No single peer should be assumed permanent unless it has an explicit durable-seeder role.

> **Design rule:** Replication policy manages verified local possession under uncertainty; it does not redefine media identity or playback authority.
