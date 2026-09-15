# Media Distribution

**Authorship:** William von Meister (Project Owner) + GPT-5.6 Luna / `LUNA-HS-001` (AI Collaborator)

**Authorship rule:** This document was created collaboratively in this project. Human decisions, direction, and requirements are attributed to William von Meister; AI-authored drafting and analysis are attributed to the named AI collaborator and its unique project author ID. Author ID identifies provenance, not technical authority.

## Purpose

Media distribution moves verified representation segments between acquisition sources, local storage, peers, and the playback pipeline.

The player must not need to know which transport supplied a segment.

## Distribution API

HiveStream should expose a semantic distribution interface above transport libraries. A caller should be able to express needs such as:

```text
requestSegment(media, representation, segment)
subscribeAvailability(media, representation)
reportSegmentVerified(segment)
releaseSegment(segment)
```

The concrete API is intentionally unspecified until implementation evidence requires it.

## Acquisition order

A practical request path is:

```text
Playback request
      ↓
Local verified ReplicaStore
      ↓ miss
Available peer(s)
      ↓ miss/failure
HTTP origin/CDN
      ↓
Verify
      ↓
ReplicaStore
      ↓
Playback
```

This is a policy target, not a requirement that every request always follows every step.

## P2P transport

The initial implementation may use `p2p-media-loader` with WebRTC data channels and HTTP fallback. HiveStream owns the semantic identity and replica model above that engine.

Transport identifiers such as a loader swarm ID must not silently become HiveStream Media identity.

## HTTP fallback

HTTP remains a first-class path. P2P failure must not make valid media unplayable when an origin or equivalent HTTP source is available.

Fallback conditions include:

- no peers,
- peer connection failure,
- peer timeout,
- unavailable segment,
- corrupt peer data,
- browser transport limitations,
- stale availability metadata.

## Upload path

A peer should serve only data it is authorized and able to serve. In particular, unverified bytes must not be promoted into normal replica service.

A successful upload measurement should correspond to actual media bytes transferred, not merely a signaling event or established connection.

## Source attribution

Distribution telemetry should preserve the actual acquisition source when possible:

- local replica,
- peer/P2P,
- HTTP origin/CDN,
- other explicitly identified source.

String-based source classification is useful for experiments but should not become a permanent semantic contract without verifying the underlying library's event values.

## Failure isolation

P2P distribution and playback synchronization are independent concerns. Playback synchronization may fail while media distribution continues; media distribution may fail while application state remains synchronized.

## Future transports

WebTorrent, WebTransport/MOQT, alternative WebRTC arrangements, or native transports may be added later behind the same semantic distribution boundary. They should not force application code to depend on transport-specific concepts.

> **Design rule:** HiveStream owns what a segment means and whether it is trusted; the distribution engine determines how bytes move.
