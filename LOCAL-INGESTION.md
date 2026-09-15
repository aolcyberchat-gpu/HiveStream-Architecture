# Local Ingestion

**Authorship:** William von Meister (Project Owner) + GPT-5.6 Luna / `LUNA-HS-001` (AI Collaborator)

**Authorship rule:** This document was created collaboratively in this project. Human decisions, direction, and requirements are attributed to William von Meister; AI-authored drafting and analysis are attributed to the named AI collaborator and its unique project author ID. Author ID identifies provenance, not technical authority.

## Purpose

Local ingestion allows media that begins as a local file to enter the same identity, segmentation, storage, and replication system as network-acquired media.

## Pipeline

```text
LOCAL FILE
   ↓
INGESTION
   ↓
MEDIA IDENTITY
   ↓
REPRESENTATION / SEGMENTATION
   ↓
VERIFIED LOCAL REPLICA
   ↓
ADVERTISEMENT / P2P EXCHANGE
```

## Identity

A local file should not automatically define a globally meaningful Media ID merely because it has a filename. Identity should be derived from an explicit media-identity policy capable of distinguishing the asset from its representations.

A content-derived identity may be useful, but the exact hashing/canonicalization strategy is an implementation decision.

## Segmentation

Local media may not already use the same HLS segmentation as network media. Ingestion therefore has two separate concerns:

1. establish Media/Representation identity;
2. produce a representation whose segments can participate in the replica/distribution model.

The architecture must not assume that source-file byte ranges and playback segments are interchangeable identities.

## Verification

Segments produced by local ingestion should enter trusted replica state only after the same applicable integrity rules used for network-acquired segments.

## Browser constraints

Local ingestion must account for browser memory, storage quota, file size, codec support, processing time, and permission boundaries. Large-file workflows may require streaming or worker-based processing rather than loading the complete file into memory.

## Sharing

A user who chooses to ingest local media should explicitly control whether it becomes available to other peers. Local ingestion creates a replica; it does not automatically imply unrestricted sharing.

## Application independence

CyTube may be the first UI for local ingestion, but the ingestion pipeline belongs to HiveStream Core and should remain usable by future applications.

> **Design rule:** Local media is another entry point into the same HiveStream identity and replica system, not a parallel media architecture.
