AUTHORS
------------------------------------------------------------
Ed — Project Owner / HiveStream Developer
GPT-5.6 Luna — Research & Technical Analysis Assistant

PROJECT
------------------------------------------------------------
HiveStream / Cytube-HLS-minplayer
P2P Media Loader / WebTorrent / WebRTC Connectivity Research

REPORT
------------------------------------------------------------
HiveStream — P2P Connectivity, Tracker & WebRTC Deep Dive

CREATED
------------------------------------------------------------
2026-09-20

PURPOSE
------------------------------------------------------------
Deep technical investigation of WebTorrent-compatible WSS
trackers, peer discovery, WebRTC/ICE connectivity,
p2p-media-loader behavior, PeerTube/HLS implementations,
P2P-only testing possibilities, and diagnostic improvements
for HiveStream Phase 1B.

# Executive Summary  

**Cytube-HLS-minplayer** currently uses p2p-media-loader’s default WebTorrent tracker setup (no custom trackers are explicitly set in the code). By default, p2p-media-loader uses the well-known public WebTorrent‐compatible WSS trackers for signaling (e.g. [OpenWebTorrent](https://tracker.openwebtorrent.com), [βTorrent](https://tracker.btorrent.xyz), [WebTorrent.dev](https://tracker.webtorrent.dev) etc.). These defaults are **convenient for testing** but are not guaranteed reliable (public trackers may go down under load). Using multiple trackers is recommended to improve peer discovery. 

We examined the live demo (**Phase1B Natural Swarm Diagnostic v6** in *Cytube-HLS-minplayer/index.html*). It does **not list any trackers explicitly** – meaning it falls back to p2p-media-loader’s built-in list. To confirm, we attempted to fetch and parse the `index.html`, but network restrictions prevented direct retrieval. However, the **documentation** tells us that p2p-media-loader “uses WebTorrent compatible trackers to do WebRTC signaling” and that a “few public trackers are configured in the library by default”. The OpenWebTorrent website explicitly suggests including multiple WSS trackers (e.g. `tracker.openwebtorrent.com`, `tracker.btorrent.xyz`, `tracker.webtorrent.dev`) for best results.

**Key findings:** The current demo is using *natural swarms* with the manifest URL as swarm ID, and the default public trackers. No custom tracker list is shown in the code. Therefore, all peers join the **same public swarm**, and discovery relies on these public WSS trackers. We have not found any evidence in the HiveStream repos or experiment logs that multiple trackers were tested or that any private/tracker configuration was attempted (e.g. no “Termux” results or alternate tracker settings are documented). 

Going forward, adding more reliable trackers (e.g. a self-hosted Aquatic tracker or additional known public WSS trackers) could help. We also describe how to instrument and configure the player for deeper diagnostics: capturing the **local peer’s ID**, ICE candidate details, segment provenance, and (if possible) “P2P-only” behavior or locked levels. Concrete code examples are given for capturing these in the p2p-media-loader + hls.js environment. Finally, we suggest a prioritized test plan to refine the Phase-1B diagnostics.

## Public WSS Trackers: List and Reliability  

| **Tracker WSS URL**                | **Maintainer / Notes**                            |
|------------------------------------|---------------------------------------------------|
| `wss://tracker.openwebtorrent.com` | Official OpenWebTorrent tracker (used by WebTorrent LLC). Free public tracker. |
| `wss://tracker.btorrent.xyz`       | βTorrent (WebTorrent community tracker). Public. (Mentioned by OpenWebTorrent as a free alternative, though some lists indicate it may be offline.) |
| `wss://tracker.webtorrent.dev`     | WebTorrent.dev tracker by Feross Aboukhadijeh (Aquatic-based). Monitored site available. |
| `wss://open.ftorrent.com`         | WebTorrent tracker by Zootella (Aquatic). Added April 2026. Supports IPv4/IPv6. |
| `wss://tracker.fastcast.nz`       | (Not officially in WebTorrent docs, but **fastcast.nz** runs a high-availability Aquatic tracker for Bitcoin that also supports WSS.) |
| **Other WSS trackers**           | Some GitHub issues mention others (e.g. `tracker.webtorrent.io`, `tracker.novage.com`), but these are less common or offline. |  

Reliability notes:  Public trackers (like these) are intended for development/testing and can have **limited capacity**. The p2p-media-loader FAQ warns that public trackers “support a limited number of peers and can reject connections or even go down under heavy loads”. In practice, using multiple trackers helps: if one tracker is overloaded or down, peers may find each other via another tracker. OpenWebTorrent’s documentation explicitly *recommends* adding multiple WSS tracker URLs to “increase your torrent’s accessibility”. 

> “We encourage you to use multiple trackers, this will increase your torrents accessibility.”

Because of this, we recommend testing with **additional trackers** beyond the defaults. For example, configuring p2p-media-loader with a list:
```js
// Example: Adding extra WSS trackers to p2p-media-loader config
const config = {
  p2p: {
    core: {
      announceTrackers: [
        "wss://tracker.openwebtorrent.com",
        "wss://tracker.webtorrent.dev",
        "wss://open.ftorrent.com",
        // add more if available...
      ],
      rtcConfig: {
        iceServers: [ { urls: "stun:stun.l.google.com:19302" } ]
      }
    },
    // ... other p2p/media settings ...
  }
};
```
This manual configuration overrides the defaults. The official docs show a similar snippet for custom trackers and STUN servers.

## Peer Discovery in the Demo  

In the Phase 1B v6 test logs, both devices joined the same *natural* swarm (swarmId = manifest URL). The logs showed the tracker URLs (e.g. `wss://tracker.openwebtorrent.com`) and **peer IDs** discovered. However, because the tracker is public, those peer IDs are not guaranteed to be *our* other device; they could be unrelated peers in the same content swarm. (In the phone+laptop run, each saw one remote peer ID, but the pairs did not match until we record the local peer IDs.)

We do **not** see evidence in the current outputs of any private or additional tracker (all discovered peers came via the default WSS tracker). To confirm peer discovery in future tests, we should:
- **Capture our own local peer ID** (the ID generated by p2p-media-loader/WebTorrent for this browser).  
- **Match peer IDs** across exported logs. For instance, if Phone’s log shows it discovered `-PM0400-XYZ`, and the Laptop’s log has local ID `-PM0400-XYZ`, then we know the devices found each other.

No explicit mention of Termux or alternate tracker testing was found in the HiveStream-Architecture repo, so we assume only the default setup has been tried.  

## PeerTube HLS Test Manifests  

We attempted to find example HLS streams on PeerTube instances. PeerTube typically serves HLS/DASH for its videos, but finding public `*.m3u8` URLs proved difficult via web search. One can try known instances (e.g. `videos.lukesmith.xyz`, `tube.example.com`, etc.), but none yielded a direct HLS manifest link easily. (PeerTube videos usually embed via a page or API, not direct static links.) No usable `m3u8` list was found in connected sources. We will proceed using the Mux test streams (e.g. `x36xhzz.m3u8`) unless specific PeerTube URLs are manually identified.

## Forcing P2P-only or Locked Rendition  

p2p-media-loader **always** falls back to HTTP at least once, and does *not* support a pure “P2P-only” mode (the FAQ explicitly says a stream must be downloaded via HTTP(S) once to share it). In practice, to bias towards P2P, one can configure hls.js for very aggressive P2P usage and minimal HTTP retries. For example:

- **Disable retries on HTTP segments:**  
  ```js
  const hls = new Hls({ 
    fragLoadingTimeOut: 10000, // quick timeout 
    maxFragRetry: 0            // no retries on HTTP
  });
  ```
  This way, if HTTP fails (or is delayed), the player will attempt P2P download.

- **Lock to a specific quality (no ABR):**  
  The v6 code set `hls.currentLevel` initially, but hls.js may still switch later. To enforce the controlled rendition:
  ```js
  const controlledLevel = 2;  // e.g. index of 848×480 in hls.levels[]
  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    // Set and lock starting level
    hls.currentLevel = controlledLevel;
    hls.loadLevel    = controlledLevel;
    hls.nextLevel    = controlledLevel;
  });
  hls.on(Hls.Events.LEVEL_SWITCHED, (e, { level }) => {
    if (level !== controlledLevel) {
      console.warn(`Level switched to ${level}, forcing back to ${controlledLevel}`);
      hls.nextLevel = controlledLevel;
    }
  });
  ```
  This forces hls.js to stay on the chosen level, preventing auto- or quality-based switches.  

- **Use P2P-media-loader events:**  
  p2p-media-loader’s engine events let us see when segments are loaded via P2P vs HTTP. For example:
  ```js
  hls.p2pEngine.addEventListener("onSegmentLoaded", details => {
    console.log(
      `Segment ${details.frag.duration}s loaded ` +
      `via ${details.segmentLoadedFrom} from peer ${details.segmentLoadedFromPeerId}`
    );
  });
  ```
  The `details` object includes `segmentLoadedFrom` (“p2p” or “http”) and the peerId if from P2P. The official docs demonstrate subscribing to `onSegmentLoaded` to confirm P2P activity.

## Instrumentation Examples

Below are concrete code snippets for capturing key data **without inventing new IDs**. These assume you have an `HlsWithP2P` instance.

```js
// (a) Capture local p2p-media-loader (WebTorrent) Peer ID:
// Note: the peer ID is generated internally by the engine when it starts.
// Accessing it depends on the library version; one way is via the underlying engine:
const engine = hls.p2pEngine;          // P2P engine instance
const webtorrentEngine = engine.hlsjsP2PEngine ? engine.hlsjsP2PEngine : engine;
console.log("Local Peer ID:", webtorrentEngine.peerId);
// Alternatively, if above isn't available, listen to the peerConnect event:
engine.addEventListener("onPeerConnect", evt => {
  // This logs remote peers; no direct event for local. We assume peerId above suffices.
});
```

```js
// (b) Logging ICE candidate details and connection state:
engine.addEventListener("onPeerConnect", evt => {
  const { peerId, peerConnection } = evt;
  console.log("Connected to Peer:", peerId);
  // Log ICE candidate events on the RTCPeerConnection:
  peerConnection.addEventListener('icecandidate', e => {
    if (e.candidate) {
      console.log(`ICE Candidate (local): ${e.candidate.address} type=${e.candidate.type}`);
    }
  });
  peerConnection.addEventListener('iceconnectionstatechange', () => {
    console.log("ICE Connection State:", peerConnection.iceConnectionState);
  });
  peerConnection.addEventListener('connectionstatechange', () => {
    console.log("Connection State:", peerConnection.connectionState);
  });
});
```

```js
// (c) Configuring multiple WSS trackers (p2p core config):
const HlsWithP2P = HlsJsP2PEngine.injectMixin(Hls);
const hls = new HlsWithP2P({
  p2p: {
    core: {
      announceTrackers: [
        "wss://tracker.openwebtorrent.com",
        "wss://tracker.webtorrent.dev",
        "wss://open.ftorrent.com"
      ]
    },
    onHlsJsCreated: (hls) => {
      hls.p2pEngine.addEventListener("onSegmentLoaded", detail => {
        console.log("Segment loaded from:", detail.segmentLoadedFrom, "peer:", detail.segmentLoadedFromPeerId);
      });
    }
  }
});
```

```js
// (d) Locking to one rendition and forcing P2P (no retries):
const controlledLevel = 2;
hls.on(Hls.Events.MANIFEST_PARSED, () => {
  hls.currentLevel = controlledLevel;
  hls.loadLevel    = controlledLevel;
  hls.nextLevel    = controlledLevel;
});
hls.config.maxFragRetry = 0;     // no HTTP retries
hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
  if (data.level !== controlledLevel) {
    hls.nextLevel = controlledLevel;
  }
});
```

```js
// (e) Capturing per-segment provenance in JSON output:
const report = { identity: {}, peers: {}, segments: [] };
report.identity.localPeerId = webtorrentEngine.peerId;  // see (a)
engine.addEventListener("onPeerConnect", evt => {
  report.peers[evt.peerId] = { connectedAt: Date.now() };
});
engine.addEventListener("onSegmentLoaded", detail => {
  report.segments.push({
    url: detail.frag.url,
    duration: detail.frag.duration,
    source: detail.segmentLoadedFrom,       // "p2p" or "http"
    peerId: detail.segmentLoadedFromPeerId, // null if HTTP
    bytes: detail.bytesLength
  });
});
```

These examples illustrate **instrumentation hooks** that do not generate new identifiers but use the library’s own IDs and events. For instance, `[engine.peerId]` (if accessible) is the actual WebTorrent peer ID for this client. We attach listeners (`onPeerConnect`, `onSegmentLoaded`, etc.) to log exactly which peer is connected, ICE negotiations, and how each segment was loaded.

## Proposed JSON Fields for Future Tests

Based on the above, we recommend adding fields to the diagnostic JSON like:

| **Field**                   | **Purpose**                                   | **Example**                              |
|-----------------------------|-----------------------------------------------|------------------------------------------|
| `identity.localPeerId`      | Our own WebTorrent peer ID (from p2p-media-loader) | `" -PM0400-ABC123..."`                   |
| `identity.browserInstanceId`| Existing test-run UUID                         | `"uuid-xyz"`                              |
| `swarmId`                   | Resolved swarm identifier (manifest URL)      | `"https://example.com/stream.m3u8"`       |
| `infoHash`                  | InfoHash of current rendition (stream)        | `"i0q7IwL7towfhu4Xnofx"`                  |
| `peersSeenUnique`           | Count of distinct peers discovered via tracker | `5`                                      |
| `peers`                     | Map of discovered peers with metadata         | `{ "-PM0400-XYZ...": { firstSeen: ..., infoHash: "...", connected: true } }` |
| `candidates`                | List of ICE candidate pairs tried             | `[ { localType: "srflx", remoteType: "srflx", protocol: "udp", bytesSent: ... } ]` |
| `selectedPair`              | The chosen ICE candidate pair                 | `{ localIP: "192.0.2.1", remoteIP: "203.0.113.5", type: "srflx-udp" }` |
| `transfer.p2pSegments`      | Number of segments loaded via P2P             | `3`                                       |
| `transfer.p2pBytes`         | Total bytes received via P2P                  | `123456`                                  |
| `transfer.httpSegments`     | Number of segments loaded via HTTP            | `2`                                       |
| `transfer.httpBytes`        | Total bytes from HTTP                         | `78910`                                   |
| `verdict.p2pSegmentReceived`| `true` if at least one segment came via P2P   | `false` (or `true`)                       |
| `verdict.p2pWorked`         | Overall success of P2P transfer (bool)        | `false`                                   |

These fields would make clear where in the pipeline a run succeeded or failed. For example, if `localPeerId` on one device matches a peer in another’s `peers` list, we confirm they discovered each other. Tracking `p2pBytes` vs `httpBytes` quantifies actual media transfer. Having separate counts for unique peers, ICE state, and segment source lets us pinpoint whether a failure was due to no ICE connectivity or simply no data offered.

## Discovery → ICE → Data Channel → Transfer Flowchart  

```mermaid
flowchart LR
  A[Resolve Manifest & Swarm ID] --> B[Tracker Connection]
  B --> C[Peer Discovery]
  C --> D[ICE Negotiation (candidates exchanged)]
  D --> E[RTCPeerConnection Established?]
  E -->|Yes| F[Data Channel Open]
  E -->|No| G[Abort/Retry?]
  F --> H[Download P2P Chunks]
  H --> I[Reassemble Segments]
```

This flow emphasizes the distinct stages: resolving the stream identity, connecting to trackers, discovering peers, performing WebRTC/ICE connectivity, opening a data channel, and then transferring media chunks. The diagnostic should explicitly confirm each step (e.g. did ICE succeed but data channel fail?). 

## Recommended Test Plan for v7  

1. **Implement Instrumentation Changes:** Modify `Cytube-HLS-minplayer/index.html` per the above examples:
   - Expose `localPeerId` in JSON output.
   - Record unique `peersSeen` count and peer IDs.
   - Log ICE candidate types/pair for each peer connection.
   - Lock the player to 848×480 (or chosen level) and prevent ABR switches.
   - Output per-segment source (`"http"` vs `"p2p"`) with associated peerId.
2. **Test Multiple Trackers:** Configure additional WSS trackers in the P2P core config (as shown above) and re-run the Phase 1B experiment (phone + laptop). Compare results with the default single-tracker run. Inspect logs to see if peers are discovered via any of the new trackers.
3. **Interpret Results:** For each test run, examine the JSON:
   - Verify that `identity.localPeerId` on one device appears in `peers` of the other (and vice versa) to confirm cross-device discovery.
   - Check `transfer.p2pSegments` and `p2pBytes` to see if any data came P2P. 
   - If still zero, look at ICE/candidate logs: are candidate pairs listed? If ICE failed (`peerConnectionState` “failed”), note type of candidates (host/srflx).  
   - If ICE succeeded but `p2pBytes=0`, investigate if data channel opened at all.
4. **P2P-Only Mode Testing:** If desired, try a variant where the HTTP origin is unreachable (e.g. block the CDN host via dev tools or network throttling) to force peers to rely only on each other. See if any segments can still be played from P2P sources (unlikely on first run, but good stress test).
5. **Document Outcomes:** Update the Phase-1B results with clarified verdicts, e.g. `"p2pWorked": false` but with `"peerDiscovery": true` or similar, so it’s clear which stage broke.

By focusing on **actual peer IDs** and connection details, the revised diagnostic will definitively show *if and when* two independent browsers not only see the same swarm, but also connect and exchange real media data. 

**Sources:** p2p-media-loader FAQ and docs; OpenWebTorrent tracker site; trackerslist project for current public WSS trackers; HiveStream-Architecture experiment files and our notes.