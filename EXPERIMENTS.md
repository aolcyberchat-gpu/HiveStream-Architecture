# Experiments

**Authorship:** William von Meister (Project Owner) + GPT-5.6 Luna / `LUNA-HS-001` (AI Collaborator)

**Authorship rule:** This document was created collaboratively in this project. Human decisions, direction, and requirements are attributed to William von Meister; AI-authored drafting and analysis are attributed to the named AI collaborator and its unique project author ID. Author ID identifies provenance, not technical authority.

## Purpose

Experiments are the bridge between architecture and implementation claims. They should test one meaningful question, capture raw evidence, and avoid converting inference into fact.

## Evidence classes

Each result should be classified as:

- **PROVEN** — directly demonstrated by reproducible evidence;
- **STRONG INFERENCE** — supported by evidence but not directly established;
- **UNPROVEN** — plausible but not demonstrated;
- **FAILED** — tested and contradicted by the observed result.

## Required experiment record

Each experiment should record:

```text
Experiment ID
Date/time
Code/version
Browser/device/runtime
Configuration
Input media/representation
Swarm/transport configuration
Observed events
Raw measurements
Result
Evidence classification
Limitations
Next test
```

## P2P transfer proof

The first media-plane proof should distinguish:

- peer connection,
- peer discovery,
- P2P media-byte download,
- P2P media-byte upload,
- actual segment source,
- HTTP bytes,
- playback consumption.

The strongest result is reproducible non-zero P2P media transfer tied to identifiable segments and measurable bytes.

## Persistence proof

A persistence experiment should show:

1. segment acquired and verified;
2. segment persisted;
3. browser/session reload;
4. original HTTP source unavailable or intentionally blocked;
5. segment recovered from local ReplicaStore;
6. integrity still verified;
7. playback or another consumer successfully uses the recovered segment.

## Churn proof

A churn experiment should remove or interrupt peers and verify that:

- local verified replicas survive peer loss;
- playback can fall back to HTTP when available;
- a replacement peer can resume distribution;
- stale availability claims do not become trusted data.

## Replication proof

A replication experiment should demonstrate that policy changes actual retention behavior under constrained storage or changing availability, rather than merely logging policy decisions.

## Local ingestion proof

A local-ingestion experiment should establish that a local file can become a verified persistent representation and, when explicitly permitted, a peer-serving replica.

## CyTube proof

A CyTube integration experiment should map observed CyTube state into HiveStream concepts without requiring CyTube internals inside Core.

## Synchronization proof

A synchronization experiment should test play/pause, seek, late join, reconnect, delayed messages, duplicate messages, and authority changes while independently observing replica integrity and media distribution.

## Raw evidence

Experiments should preserve raw JSON/log output where practical. Summaries are useful, but raw evidence should remain available so conclusions can be challenged later.

> **Design rule:** An experiment is successful when it makes a claim more reproducible—not merely when the demo looks convincing.
