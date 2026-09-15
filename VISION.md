# HiveStream Vision

## 1. The problem

Modern browser-based media systems usually treat each viewer as a consumer of a remote source. A browser downloads media, plays it, and eventually discards most of what it received.

HiveStream explores a different model: viewers can become **cooperating replicas of a shared media library**.

A device that has already acquired useful media should be able to retain, verify, and serve that media to other participating devices, subject to local policy and available storage.

The result should be a system in which useful media availability can progressively emerge from the participating devices themselves rather than depending entirely on a single origin server.

## 2. The vision

HiveStream is intended to become a **browser-native cooperative media replication system**.

The central transformation is:

```text
REMOTE MEDIA
     ↓
ACQUIRE
     ↓
VERIFY
     ↓
RETAIN
     ↓
REPLICATE
     ↓
SERVE
     ↓
OTHER PEERS RETAIN AND REPLICATE
```

The network of participants progressively constructs a distributed replica of useful media.

This is larger than P2P playback.

P2P playback is the first practical demonstration because it provides a concrete, measurable workload: one peer can acquire a segment and another peer can use it. But the long-term value is the persistent distributed replica, not merely replacing one HTTP request with one WebRTC transfer.

## 3. The core idea: media becomes a replica

HiveStream treats the following progression as fundamental:

```text
MEDIA
  ↓
REPRESENTATION
  ↓
SEGMENTS
  ↓
REPLICAS
  ↓
SWARM / PEER EXCHANGE
```

A **replica** is not simply a cache entry.

A cache primarily exists to improve the local consumer's performance. A HiveStream replica can additionally become a source for other peers.

That distinction drives the architecture.

## 4. What success looks like

The most important long-term success condition is:

> Independent, unreliable consumer devices can progressively construct, retain, verify, and serve useful replicas of shared media without requiring every playback request to return to the original media source.

A successful system should therefore demonstrate progressively stronger properties:

1. A media asset can be identified independently of transport.
2. Its representations can be identified independently of the application.
3. Segments can be verified before entering a replica.
4. Peers can exchange actual media bytes.
5. Acquired segments can persist beyond the immediate playback session.
6. A peer can reuse retained media after reload or origin interruption.
7. Peers can continue exchanging media despite churn.
8. Replication can become policy-driven rather than accidental.
9. Higher-availability nodes can maintain durable replicas.
10. Applications such as CyTube can consume the system without defining its core semantics.

## 5. P2P is a mechanism, not the product definition

HiveStream should not be defined as merely a P2P video player.

P2P delivery is one mechanism for moving media between replicas. HTTP remains important for bootstrap and fallback. Local storage is important because it turns acquired bytes into a reusable replica. Replication policy is important because storage alone does not determine what should be retained or served.

The architectural objective is therefore broader:

```text
                 ┌──────────────┐
                 │ Shared Media │
                 └──────┬───────┘
                        │
                 ┌──────▼───────┐
                 │    Origin    │
                 └──────┬───────┘
                        │
             ┌──────────▼──────────┐
             │ Participating Peers │
             └──────────┬──────────┘
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
       Replica       Replica       Replica
          │             │             │
          └─────────────┼─────────────┘
                        │
                  Peer Exchange
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
       More           More          More
      Replicas       Replicas      Replicas
```

The system becomes more useful as participating peers collectively retain more useful verified data.

## 6. Browser-first

The first target is the browser because browsers are already present on the devices that consume media and expose the primitives needed for the initial system:

- HTML media playback
- JavaScript
- IndexedDB
- WebRTC
- HTTP
- service and worker mechanisms
- browser-managed storage

Browser limitations are part of the design problem, not reasons to ignore browser deployment.

Storage quotas, tab lifetime, device availability, permissions, background execution, and connection churn must be treated as real system conditions.

## 7. One semantic core

The system should eventually support several classes of nodes without creating separate architectural concepts for each:

- ephemeral browser peers
- persistent browser peers
- durable seeders
- future desktop or server nodes

The implementation may differ because the environments have different capabilities. The semantic model should not.

A durable node should therefore be understood as a node with better persistence and availability, not as a completely different media system.

## 8. CyTube is the first application, not the foundation

CyTube is an important first integration because it already provides rooms, playlists, users, synchronized playback, and a practical environment for testing cooperative media distribution.

But HiveStream must not become a collection of CyTube-specific assumptions.

The intended relationship is:

```text
CyTube
   ↓
CyTube Adapter
   ↓
HiveStream Core
   ↓
Replica / Distribution / Replication / Ingestion
```

Other applications should eventually be able to use the same core concepts.

## 9. Local media belongs in the same system

A locally supplied media file should not become a special-case feature.

The desired pipeline is:

```text
LOCAL FILE
    ↓
INGESTION
    ↓
MEDIA IDENTITY
    ↓
REPRESENTATION / SEGMENTATION
    ↓
LOCAL PERSISTENT REPLICA
    ↓
P2P ADVERTISEMENT / EXCHANGE
```

This is important because local ingestion demonstrates that HiveStream can create a replica from an origin other than the public network source.

## 10. Evidence-driven development

HiveStream should resist architectural complexity that is not supported by demonstrated need.

Each major capability should have a concrete proof condition.

For example, a successful WebRTC connection does not prove P2P media distribution. A meaningful Phase 1 proof requires actual media bytes to move between peers and measurable evidence that the transfer occurred.

Likewise, writing data to IndexedDB does not prove persistent replication. A persistence proof should demonstrate that retained verified media can be reused after the original acquisition context is gone.

The project should therefore prefer:

```text
HYPOTHESIS → SMALLEST EXPERIMENT → MEASURABLE EVIDENCE → DECISION
```

rather than:

```text
HYPOTHESIS → LARGE IMPLEMENTATION → ASSUMPTIONS
```

## 11. What HiveStream is not trying to become first

The initial system does not need to solve every distributed-systems problem.

It does not initially require:

- a global media catalog
- a token economy
- reputation scoring
- recommendation graphs
- a universal identity system
- multiple competing media protocols
- a complete distributed database
- sophisticated synchronization before media replication works
- a second P2P media stack merely for architectural variety

Those may become useful later. They should not obscure the first proof.

## 12. The first architectural proof

The first major proof should be simple enough to explain in one sentence:

> Two independent browser peers can acquire the same media, exchange actual verified segments over P2P, and continue to use HTTP when P2P is unavailable.

From there, the proof grows:

```text
HS-001 Identity
      ↓
HS-002 Segment integrity
      ↓
HS-003 Actual P2P segment transfer
      ↓
HS-004 Persistent replica
      ↓
HS-005 Reuse after reload / origin loss
      ↓
HS-006 Peer churn + HTTP fallback
      ↓
HS-007 Durable seeder
      ↓
HS-008 Replication policy
      ↓
HS-009 Multi-tab semantics
      ↓
HS-010 Local ingestion
      ↓
HS-011 CyTube adapter
      ↓
HS-012 Higher-level synchronization
```

Each step should produce evidence that justifies the next.

## 13. Long-term direction

The long-term HiveStream system should make media availability increasingly cooperative:

```text
                 ORIGIN
                   │
                   ▼
             ┌───────────┐
             │   Peer A  │
             └─────┬─────┘
                   │
          ┌────────┼────────┐
          ▼        ▼        ▼
       Peer B    Peer C   Seeder
          │        │        │
          └────────┼────────┘
                   ▼
              More Peers
                   │
                   ▼
           Distributed Replica
```

No individual consumer needs to possess everything.

The system should instead allow useful portions of a media library to become distributed across participants, with replication decisions adapting to demand, availability, storage limits, and peer conditions.

That is the vision: **media that becomes progressively more distributed, persistent, and cooperative as peers participate.**
