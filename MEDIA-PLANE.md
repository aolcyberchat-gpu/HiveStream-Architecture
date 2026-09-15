# Media Plane

**Authorship:** William von Meister (Project Owner) + GPT-5.6 Luna / `LUNA-HS-001` (AI Collaborator)

**Authorship rule:** This document was created collaboratively in this project. Human decisions, direction, and requirements are attributed to William von Meister; AI-authored drafting and analysis are attributed to the named AI collaborator and its unique project author ID. Author ID identifies provenance, not technical authority.

## Purpose

The media plane carries actual media bytes and turns them into trusted local replica data and playable media.

## Path

```text
HTTP / Peer / Local Replica
          ↓
      Segment bytes
          ↓
       Verify
          ↓
     ReplicaStore
          ↓
     Distribution API
          ↓
       HLS / hls.js
          ↓
   HTMLMediaElement
```

The precise implementation may combine these steps for efficiency, but the trust boundary remains explicit.

## Media-byte evidence

The meaningful P2P proof is transfer of actual media bytes. Connection establishment, peer discovery, tracker registration, or signaling success is not equivalent to segment transfer.

Telemetry should therefore distinguish peer connectivity from P2P media-byte transfer.

## Verification

A media-plane implementation must identify the segment being transferred and apply the applicable integrity rules before treating the bytes as trusted replica content.

## Backpressure

Playback demand, storage pressure, peer bandwidth, and HTTP availability can all affect scheduling. The media plane should avoid requiring unbounded buffering or assuming every source has equal throughput.

## Fallback

If a peer cannot satisfy a request, the request should be eligible for another peer or HTTP acquisition according to distribution policy. A transient P2P failure must not corrupt application state.

## Separation from control plane

Control messages can request or describe media availability, but actual segment bytes travel through the media plane. A control message is never itself proof that a segment exists locally.

> **Design rule:** Only the media plane moves media bytes; only verified bytes enter trusted replica state.
