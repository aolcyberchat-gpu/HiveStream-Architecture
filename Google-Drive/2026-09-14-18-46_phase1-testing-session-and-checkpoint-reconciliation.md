Human Project Lead: William / AI: Claude Sonnet 5 (Anthropic)
Status: WORKING / SCRATCH LAYER

# HiveStream Phase 1 Testing Session — Full Log, Findings, and Reconciliation
# with HIVESTREAM-P2P-ARCHITECTURE-RESEARCH-CHECKPOINT-2026-09-13.md

Covers a multi-round live P2P testing session (phone + laptop, multiple browsers,
multiple methodologies) run 2026-09-12 through 2026-09-14, and its reconciliation
against the cytube-knowledge repo's 2026-09-13 architecture checkpoint document
(commit 54673a6). The testing in this document is real evidence, not superseded
by the checkpoint doc — the checkpoint doc's own Section 2 explicitly cites
results consistent with this testing ("the current Phase 1 Android Kiwi run
demonstrated...") as part of its reasoning. This document exists to preserve
the testing narrative itself, since the checkpoint doc's conclusions were
reached partly *because of* evidence like this, not independently of it.

---

## 1. What was actually tested, in order

### Round 1 — same device, two browsers (Android)
First real Phase 1 run: two different browsers on the same Android phone,
opening the test page via direct file/content:// URI (downloaded HTML, renamed
from .txt to .html, opened directly — no local server, no Termux required for
this to work). Result: clean, unambiguous proof. Browser A uploaded exactly
6,507,432 bytes via P2P; Browser B received exactly 6,507,432 bytes via P2P,
with segment id 2 explicitly tagged "source": "p2p". Verdict: proof: true on
the receiving side.

Caveat identified immediately: same-device WebRTC can succeed via host
candidates without any real NAT traversal, so this proved the *mechanism*
(P2P Media Loader's chunk classification, byte accounting, WebRTC data channel
transport) but not cross-device connectivity over a real network path.

### Round 2 — two devices, five browser instances, local file/content:// origin
Laptop (Firefox, Edge, Vivaldi) + phone (two Kiwi/Chrome instances), all on
same Wi-Fi, all opened via file:///content:// URIs, default swarm ID
(hivestream-phase1-proof-v1, the public default — not yet isolated).

Byte accounting analysis: the three laptop browsers formed a perfectly closed
P2P loop (total uploaded == total downloaded among them, to the byte). The two
phone browsers received significantly more via P2P (~68MB combined) than they
uploaded to each other (~20MB), indicating an external, unaccounted-for P2P
source — likely a stray/reused peer ID from an earlier test session still
open somewhere, or possible contamination from other public users sharing the
same default swarm ID. No confirmed phone<->laptop byte match.

### Round 3 — GitHub Pages origin, still default swarm ID
Hypothesis at this point: since file://path sends a null Origin header, maybe
switching to a real HTTPS origin (GitHub Pages) would fix cross-device
matching. Enabled GitHub Pages on duckwerks/HiveStream
(https://duckwerks.github.io/HiveStream/experiments/phase-1-p2p-proof.html).
Result: the opposite of the hypothesis — zero peers connected across both
8-10 minute runs (one phone, one laptop browser tested this round). This
falsified the "null origin is the problem" theory; file:// origin had
actually produced *more* successful connections than the HTTPS origin did in
this instance.

### Round 4 — instrumented WebSocket/RTCPeerConnection tracing
Built a browser-console injection script (window.WebSocket and
window.RTCPeerConnection monkey-patch, logging all tracker messages and ICE
state changes, dumping results via copy()) to see what the tracker layer was
actually doing, since the page's own JSON output doesn't expose this.

Key finding: THREE trackers are contacted by default -
wss://tracker.novage.com.ua (the library's own default — failed with code
1006 abnormal closure on every single connection attempt, entire session),
wss://tracker.webtorrent.dev (worked), wss://tracker.openwebtorrent.com
(worked). This tracker list was not previously documented anywhere in
cytube-knowledge and is new information from this session.

Real SDP offer/answer exchanges were observed flowing through the working
trackers, including between an actual phone peer ID and an actual laptop peer
ID — genuine cross-device signaling succeeded. But the script's own
"rtc": [] result (no RTCPeerConnection ever observed) was later determined to
be a false negative: valid SDP requires a real RTCPeerConnection to exist
somewhere, so the object was almost certainly being created before the
instrumentation script's patch could intercept window.RTCPeerConnection (the
CDN-loaded library initializes on page load, likely capturing its own
reference to the constructor before the console script runs). This is a known
limitation of the instrumentation approach, not evidence that no
RTCPeerConnection was created.

### Round 5 — isolated swarm ID, clean re-run, GitHub Pages origin
Used ?swarm=wcm-pages-test-2 to eliminate any possibility of public-swarm
contamination. Phone (Kiwi) ran the full page's own "Copy JSON Results" (not
just the trace script) for ~26 minutes: 0 peers connected the entire time,
67/67 segments via HTTP, proof: false.

Cross-referencing the WS trace from the same run: real SDP offer/answer WAS
exchanged with a specific peer ID that also appeared in a laptop browser's
trace during the same window — genuine tracker-level cross-device match
confirmed. But the connection never became usable (no data channel opened, no
bytes moved, peer counter correctly stayed at zero from the library's
perspective).

Root cause identified for THIS run: playback state showed "paused": true at
78 seconds into a 634-second stream after 18.5 minutes of elapsed test time.
The phone was almost certainly backgrounded/screen-locked while attention
moved to checking the laptop, which triggered mobile background-tab
throttling (video pause, deauthorized WebSocket/tracker activity). This
likely invalidates the "peerConnected: false" reading from this run and
possibly earlier phone-side rounds using the same start-then-walk-away
workflow.

### Round 6 — leftover tabs reused as an accidental staggered-start test
Laptop tabs from Round 5 had been left open (not closed) and continued
running unattended. Rather than closing them, the phone was joined into the
SAME live swarm ID, taking advantage of the laptop's unintentional head
start. Result: two laptop browsers (Edge, and a third likely-Vivaldi browser)
both achieved peerConnected: true with real WebRTC connections to distinct
peer IDs -- but p2pBytesReceived: false on both, and playback was stalled
("state": "waiting") the entire run on both. Edge additionally showed the
same peer ID connecting and disconnecting five times in three minutes,
indicating connection instability separate from the byte-exchange question.

---

## 2. The two live working theories at end of session

### Theory A — cold-start symmetry problem
The only round that produced confirmed P2P byte transfer (Round 1) had a
real timing offset: Browser A started and buffered for several seconds before
Browser B started. Every subsequent round that produced connected-but-zero-
bytes had browsers starting within seconds of each other. If two peers
request the same segment near-simultaneously, HTTP wins the race before any
P2P advertisement can propagate -- there may be no asymmetry for the P2P
layer to exploit. This is William's hypothesis, arrived at independently
during the session, and it is consistent with every data point collected.

### Theory B — @latest version drift (see Section 3)
Independently surfaced during the write-up/reconciliation pass, not during
live testing itself, but consistent with the tracker-level mismatches
observed (multiple different info_hash values appearing under what should
have been one identical swarm ID across the multi-browser rounds).

These two theories are not mutually exclusive and may both be contributing
across different rounds.

---

## 3. The @latest version-drift risk -- concrete recommendation for future
test scripts

The current phase-1-p2p-proof.html loads:
  https://cdn.jsdelivr.net/npm/p2p-media-loader-hlsjs@latest/dist/...

This is a real, verified risk (confirmed directly against Novage's own v4
documentation, not just inferred): the library computes an infoHash --
a 20-character tracker-announced hash -- from a streamSwarmId built as
${peerProtocolVersion}-${swarmId}-${streamType}-${identityHash}. The 2.3.0
release (May 2026) is an explicitly documented breaking change to this exact
derivation: v2.3+ peers cannot see peers running the pre-2.3 scheme for the
same nominal stream identity, even with an identical configured swarmId.

Practical implication: if different browser sessions resolved @latest to
different actual concrete versions at different points during this multi-day
testing window (plausible for an actively developed library pulled fresh from
CDN each time), then browsers that appeared to be "in the same swarm" by
human-readable swarmId may have actually been computing different infoHash
values and never able to see each other at the tracker level at all --
independent of any real network/NAT problem. This would fully explain the
multiple distinct info_hash values observed across supposedly-identical-
swarm test rounds in this session.

RECOMMENDATION FOR ALL FUTURE TEST SCRIPTS: pin an exact version of
p2p-media-loader-hlsjs (and Hls.js) rather than @latest, and log the resolved
version string as part of every test's JSON output alongside swarmId and
infoHash. This should be applied to phase-1-p2p-proof.html directly, not just
noted as a caveat -- an unpinned dependency makes every past and future
result impossible to reliably compare against another run.

---

## 4. Reconciliation with HIVESTREAM-P2P-ARCHITECTURE-RESEARCH-CHECKPOINT-2026-09-13.md

That document (commit 54673a6, duckwerks/cytube-knowledge) was written
alongside/after testing consistent with what's logged above, and reaches
several conclusions this session's raw data supports directly:

- Section 2 ("Mobile WebRTC decision"): explicitly reviews evidence matching
  this session (signaling succeeded, SDP exchanged, ICE candidates gathered,
  no candidate pair connected on the Android run; a separate laptop run did
  reach a connected DataChannel) and concludes mobile/NAT/carrier diagnosis
  should NOT continue as a primary workstream. Desktop is designated the
  reference P2P environment; mobile is "supported opportunistically /
  graceful HTTP fallback."
- Section 17 ("Reproducibility requirement: stop using @latest"): independently
  arrives at the same pinned-version requirement identified in Section 3
  above, for the same underlying reason (the library changed materially
  during 2026, including stream identity and WebRTC/WebTorrent behavior).
- Section 18 ("Revised Phase 1 engineering plan"): specifies Phase 1B as a
  two-DESKTOP-peer proof (not phone+laptop), with an explicit metric list
  (P2P bytes sent/received, HTTP bytes, segment counts, swarm ID, infoHash,
  peer connection time, playback continuity) and a pinned dependency version
  as a prerequisite (Phase 1A).
- Section 19 ("Things explicitly deferred") lists carrier-specific NAT
  mapping, exhaustive mobile STUN testing, and VPN/cellular permutation
  matrices as deliberately NOT current work items.

IMPORTANT: this testing session is not wasted effort superseded by that
document. The document's own reasoning in Section 2 is built on evidence of
exactly this kind. The practical conclusion is that further phone<->laptop
NAT-traversal debugging should stop being the active workstream going
forward, in favor of the Phase 1B desktop-only proof -- not that the prior
testing lacked value.

---

## 5. Ecosystem validation -- these are not unproven technologies

Worth stating plainly, since it changes how much risk any of the above
actually represents: HLS, WebRTC, and P2P Media Loader's hybrid HTTP+P2P
architecture are NOT experimental or unproven in the broader ecosystem.
PeerTube -- a real, production, federated video platform -- runs exactly
this stack (HLS.js + P2P Media Loader + WebRTC + WebTorrent-compatible
tracker signaling + HTTP fallback) as its documented, shipping client
architecture (confirmed directly against PeerTube's own architecture docs
during this session's reconciliation pass, not just asserted by the
checkpoint document). The open question for HiveStream was never "does this
architecture work" -- it demonstrably does, in production, for other people.
The open and genuinely HiveStream-specific questions are persistent
room-level replication, playlist-aware prefetch, and a stable HiveStream-level
media identity layered on top of the proven transport -- not the transport
itself.

Also verified independently this session (not just cited from the checkpoint
doc): the W3C Media Source Extensions Level 2 Working Draft dated 2026-08-07
is real and current (confirmed against w3.org directly). WebTransport reached
baseline cross-browser support in March 2026, and the IETF Media-over-QUIC
transport draft is at draft-17 as of March 2026, with early production pilots
(nanocosmos, Ant Media, Red5) already shipping in narrow live-streaming use
cases -- moving faster than "future research," though still not something to
build HiveStream's near-term architecture around.

---

## 6. Concrete next steps

1. Pin an exact p2p-media-loader-hlsjs and Hls.js version in
   phase-1-p2p-proof.html (currently uses @latest for both). Log the resolved
   version, swarmId, and infoHash in every test's JSON output.
2. Run Phase 1B as specified in the checkpoint doc: two desktop browsers only,
   staggered start (informed by Theory A above -- give Peer A a real head
   start before starting Peer B), pinned dependency versions, full metric
   logging.
3. Treat cross-device (phone<->laptop) NAT traversal as a documented open
   item, not a blocker -- revisit only if a concrete production requirement
   demands it, per the checkpoint document's Section 19.
4. If a future test specifically wants to test mobile again, disable screen
   auto-lock and keep the tab foregrounded for the entire run -- Round 5's
   null result is confounded by likely background-tab throttling and should
   not be treated as clean evidence either way.

*End of document.*
