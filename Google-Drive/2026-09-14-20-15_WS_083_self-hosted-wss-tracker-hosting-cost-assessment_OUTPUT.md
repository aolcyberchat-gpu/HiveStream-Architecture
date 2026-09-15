# WS-083 — Self-Hosted WSS BitTorrent/WebTorrent Tracker for p2p-media-loader: Day-One Decision Deep Dive

**Authors:** Ed (project owner) & Claude (Anthropic — web research on tracker software, hosting providers, and TLS/DNS setup, cross-referenced against Novage/p2p-media-loader's own documentation and prior WS-080/WS-081 tracker-scoping findings)

**Date:** 2026-09-14

**Nature of this document:** a decision deep-dive requested by Ed on one specific open item (self-hosted tracker, day-one vs. later) that DEC-000 (2026-09-14) already recommended as a default. This document is the supporting research for that recommendation — tracker software, hosting, TLS, wiring into p2p-media-loader, and honest cost/effort accounting — not a new architectural conclusion.

---

## 0. tl;dr

- **Tracker software:** `wt-tracker` (Novage's own tracker, same org as p2p-media-loader) is the best fit — purpose-built for exactly this use case, handles tens of thousands of WSS peers on trivial hardware, so HiveStream's actual scale (single-digit peers per CyTube room) is a non-issue. `bittorrent-tracker` (webtorrent org) is the more general-purpose alternative if HTTP/UDP tracker support is ever wanted alongside WS.
- **Hosting:** no realistic serverless/zero-infrastructure option exists for a WSS tracker, because it needs long-lived stateful connections, which rules out most "free" PaaS tiers. The realistic choices are (a) a genuinely free always-on VM (Oracle Cloud "Always Free" Ampere A1, or Google Cloud's `e2-micro`), both usable from Termux via SSH with no desktop required, or (b) a ~$4-5/month VPS (Hetzner CX22-class) if free-tier signup friction isn't worth fighting.
- **TLS/DNS:** needs one real domain name (a few dollars/year) pointed at the VM's IP, then either Caddy (automatic Let's Encrypt renewal, minimal config) or Cloudflare Tunnel (no port-forwarding, no certbot maintenance at all, Cloudflare handles TLS) sitting in front of the tracker process.
- **Wiring in:** `trackerAnnounce: ["wss://your-tracker/"]` plus a `swarmId` you compute per-CyTube-room (not left at the library's manifest-URL-derived default) in p2p-media-loader's config — this is the actual privacy control, not just "self-hosted vs public."
- **Cost/effort, honestly:** near-$0 to ~$5/month, plus roughly an evening of one-time setup and occasional (not routine) maintenance. Given the actual privacy stakes — a guessable swarm ID on a public tracker lets any WebTorrent/p2p-media-loader client anywhere discover and connect to the IP addresses of everyone in a CyTube room — this is a cheap trade, and DEC-000's take (do it day one, not as a later upgrade) holds up under this closer look.
- **Middle ground:** none of the "hosted tracker" options that exist are actually private — they're public/shared infrastructure by design. There's no vendor offering "managed private WebTorrent tracker as a service." The closest thing to a middle ground is deferring your own domain/TLS ceremony by using Cloudflare Tunnel in front of a free-tier VM, which removes most of the ops burden without giving up the privacy property.

---

## 1. Tracker software options

### wt-tracker (Novage) — recommended primary choice

`wt-tracker` is written and maintained by Novage, the same organization that builds p2p-media-loader itself — it's listed as p2p-media-loader's own companion project, not a third-party dependency. That relationship matters more than it might seem: it means the tracker's WebSocket/WebRTC-signaling protocol is guaranteed to track whatever p2p-media-loader's client side expects, with no separate compatibility layer to worry about.

Technical characteristics:
- 100% TypeScript, built on `uWebSockets.js` (a high-performance native WebSocket binding), with CI, unit tests, and static analysis — this is not a toy or an unmaintained curiosity.
- Its own README states it handles up to 30,000 WebSocket Secure peers on a VPS with only 2 GiB RAM and 1 vCPU. HiveStream's realistic per-room peer count is in the single digits to low tens. This isn't a capacity concern in any scenario reachable by the current roadmap — it means the tracker can run comfortably on hardware far smaller than even the cheapest paid VPS tier, which is exactly why the free-tier hosting options in Section 2 are viable rather than wishful.
- Requires Node.js 22.18+ (a recent-ish requirement, worth checking against whatever Node version ends up on the VM).
- Configuration is a single JSON file (path, idle timeout, max connections, compression, announce interval) — there's a sample `config.json` in the repo to start from.
- Supports `ws://` and `wss://` simultaneously, and exposes a `/stats.json` endpoint, which is convenient for a later "is my tracker actually alive" health check without extra tooling.
- Smaller community than `bittorrent-tracker` (278 stars vs. a much larger user base for the WebTorrent-org project), but that's expected for a narrower-scope, single-purpose tool built by a small specialist consultancy (Novage, LLC — P2P development and consulting) rather than a broad community project. Given it's literally built by the same people as the library HiveStream already depends on, the smaller star count doesn't read as a maintenance-risk signal here.

### bittorrent-tracker (WebTorrent org) — the general-purpose alternative

This is the reference tracker implementation used by the WebTorrent project itself (`webtorrent/bittorrent-tracker`), supporting HTTP, UDP, and WebSocket tracker protocols all in one package, either as a CLI (`bittorrent-tracker --ws`) or as an importable `Server` class.

- Actively maintained — the v10 release line moved the package to ESM-only and swapped in maintained dependencies (a maintained `simple-peer` fork, a maintained `ws`-based websocket implementation) in 2022-2023, and it remains WebTorrent's own production tracker software.
- The project's own GitHub issue history is candid about a real scaling limitation for the WebSocket tracker specifically: the original design is single-process with an in-memory database, which is fine for HTTP/UDP (stateless per request) but becomes a real bottleneck for WebSocket trackers because every peer needs a held-open connection (CPU + RAM per connection) and inter-peer signaling messages have to be relayed through the server. The project's own numbers: roughly 12.8 KB of memory per connection with the stock `ws` package, reducible to about 3.2 KB by switching to `uWebSockets.js` — which is exactly the optimization `wt-tracker` already ships with by default. Note this issue is old (2020) — worth a quick check of whether `bittorrent-tracker`'s WS transport has since adopted `uWebSockets.js` itself before treating this as still-current, but at minimum it confirms `wt-tracker`'s architecture choice was made for a real reason, not fashion.
- Given HiveStream's peer counts, this scaling ceiling is irrelevant in practice — either tracker will run this workload without breaking a sweat. The real reason to prefer `wt-tracker` is the direct upstream relationship with p2p-media-loader, not raw capacity.

### uwt (µWebTorrentTracker) and other smaller options

A lighter-weight fork/derivative (`uwt`) exists, built by the operator of the βTorrent Tracker community tracker, layering on top of `bittorrent-tracker`'s codebase with a lighter footprint. It's a legitimate option but has a much smaller footprint of adoption than either of the two above, and doesn't have the direct upstream relationship `wt-tracker` has — no strong reason to prefer it over `wt-tracker` for this project.

### Bottom line on software

`wt-tracker` is the right default: purpose-fit, actively maintained, made by the exact upstream that also makes p2p-media-loader, and absurdly over-provisioned for HiveStream's actual scale even on minimal hardware. `bittorrent-tracker` is the fallback if a reason ever emerges to also speak HTTP/UDP tracker protocols (e.g. if the WebTorrent-local-file-seeding fallback path floated in WS-080 ever gets built and needs a tracker that also serves non-browser BitTorrent clients).

---

## 2. Hosting options given no desktop/home server

The hard constraint that rules out most "avoid infrastructure entirely" options: a WSS tracker needs a long-lived, stateful process holding open WebSocket connections and relaying signaling messages between peers in real time. That rules out most serverless/FaaS-style "free" platforms (Cloudflare Workers, traditional AWS Lambda, Vercel functions) which are designed around short-lived request/response execution, not persistent bidirectional connections. It doesn't rule out platforms explicitly built with WebSocket support, but even most of those free tiers are structured as trials rather than something to build production infrastructure on top of long-term (see the free-PaaS comparison below).

### Genuinely free, always-on: cloud provider free tiers

**Oracle Cloud Infrastructure "Always Free" (Ampere A1, ARM):** the most generous free compute offer among major cloud providers — permanently free (not a time-limited trial), with an ARM-based VM. Note this was reduced mid-2026: as of June 15, 2026, the Always Free Ampere A1 allocation was halved from 4 OCPU/24 GB RAM down to 2 OCPU/12 GB RAM total (splittable across up to 4 instances). Even at the reduced size, this is wildly oversized for a tracker that (per Section 1) can handle tens of thousands of peers on 1 vCPU/2 GB. The catches worth going in aware of, not discovering mid-signup:
- Requires a credit card for identity verification (a temporary $1 authorization hold), even though the always-free resources themselves never bill.
- Oracle's account-approval and regional-capacity process has a real reputation for friction — accounts sometimes get flagged, and Ampere A1 capacity in popular regions can be hard to actually provision even after approval. This is a real, reported pain point, not a hypothetical one.
- The "home region" choice is locked in at signup and can't be changed later, so it's worth picking a large multi-availability-zone region up front.
- Practical read: worth trying given the price (free forever, not just a trial), but budget an evening for signup friction, and have a fallback plan (below) if provisioning proves difficult in your region.

**Google Cloud "Always Free" `e2-micro`:** also a genuine permanent free tier (not a 12-month trial — that's the separate $300 credit, which is different from and additional to Always Free), one `e2-micro` VM (1 shared vCPU, ~1 GB RAM) in a US region (`us-west1`, `us-central1`, or `us-east1`), 30 GB standard persistent disk, and — this is the detail that matters for a tracker specifically — 1 GB/month of network egress to most destinations outside North America (unlimited within GCP's own network / to North America otherwise, depending on which summary you read; the exact split has some inconsistency in current write-ups and is worth confirming directly against Google's current free-tier page before relying on it).

That egress cap sounds alarming for anything media-related, but it isn't a problem here specifically because **the tracker never touches video bytes.** All it does is relay small WebRTC signaling messages (SDP offers/answers, a few KB each) between peers to help them find each other; the actual video segments flow peer-to-peer over WebRTC data channels, never through the tracker. A tracker doing pure signaling for a CyTube-room-scale swarm will use a trivial fraction of even a heavily-capped free-tier egress allowance. This is a meaningfully lower-friction signup than Oracle's (no reported approval/capacity horror stories at this scale), at the cost of much smaller specs — which, again, don't matter for this specific workload.

**AWS free tier:** the EC2 portion of AWS's free tier is a 12-month trial, not a permanent always-free allocation like Oracle's or Google's — after a year it starts billing. Not recommended as the primary plan for something meant to run indefinitely, though usable as a bridge/testing environment.

### Free-tier PaaS (Render, Railway, Fly.io, etc.) — mostly not a fit

These are worth naming because they're the obvious "avoid VPS sysadmin work entirely" instinct, but the free tiers on this class of platform have become considerably less generous and less stable over 2025-2026:
- **Fly.io** is genuinely WebSocket-capable (used in production for real-time apps), but its current-2026 free offering is reported inconsistently across sources — some describe a small permanent "Hobby" allowance of a few shared-CPU 256 MB VMs, others describe only a 2-VM-hour, 7-day trial with paid plans starting around $5/month. This inconsistency itself is a signal: treat Fly.io as "cheap, not confirmed-free" rather than planning around a specific free allocation without verifying directly against Fly's current pricing page at signup time.
- **Render**'s free web-service tier exists but sleeps after 15 minutes of inactivity and cold-starts on the next request — workable for an HTTP API, actively bad for a tracker, since a sleeping tracker means peers can't find each other and existing WebSocket connections presumably get dropped on sleep.
- Most of this category shares the same shape: real free tiers exist, but they're optimized for demo/hobby traffic patterns (spin down when idle) that conflict with "always-on signaling service," or they've shrunk over time as these companies mature their business models. None of them beat "free VM you fully control" for this specific, low-resource, always-on workload.

### The realistic fallback: a genuinely cheap VPS

If free-tier signup friction (Oracle) or spec/egress limits (GCP) turn out not to be worth fighting, a small VPS is cheap enough that "free" isn't saving much in absolute terms:
- **Hetzner** CX22 (2 vCPU / 4 GB RAM) runs about €3.50-4.60/month depending on when you check pricing, with generous (20 TB/month) bandwidth — again, irrelevant for signaling-only traffic, but nice to have if the same box is ever repurposed.
- **Contabo**, **InterServer** (advertised from $3/month with a coupon), and similar budget providers land in a similar $3-6/month range for VMs far larger than a tracker needs.
- Any of these are administered the same way from Termux as the free-tier options: SSH in, install Node, clone `wt-tracker`, run it (ideally under `pm2` or a systemd unit so it survives reboots and crashes), done. No desktop required at any point — this is standard remote VPS administration, identical in kind to how you already work with GitHub from Termux.

### Recommendation

Try Oracle Cloud Always Free first specifically because it's free indefinitely rather than a trial, budgeting for possible signup/regional friction; if that stalls, Google Cloud's `e2-micro` is a lower-friction free fallback; if both feel like more hassle than they're worth for a project at this stage, a ~$4/month Hetzner box removes all the free-tier caveats for the cost of a couple of coffees a month.

---

## 3. TLS/WSS certificate setup and domain/DNS implications

A `wss://` endpoint is just a WebSocket server behind a valid TLS certificate — nothing tracker-specific about the certificate step. Two realistic paths:

### Path A: Your own domain + Caddy (recommended if you want a domain anyway)

- **Domain requirement:** you need one real registered domain name (or a subdomain of one you already control) — self-signed certificates won't work because browsers reject them for `wss://` the same way they do for `https://`, and CyTube's own client runs in a normal browser context with normal certificate validation. A cheap TLD (a `.xyz`, `.dev`, or similar) from a registrar like Porkbun or Namecheap runs roughly $2-15/year depending on TLD and any first-year promo pricing — a one-time small annual cost, separate from the hosting cost in Section 2.
- **DNS:** point an A record (and AAAA if the VM has IPv6) for a subdomain (e.g. `tracker.yourdomain.tld`) at the VM's public IP.
- **Certificate issuance/renewal:** rather than raw `certbot`, use **Caddy** as a reverse proxy in front of the Node tracker process. Caddy obtains and auto-renews Let's Encrypt certificates with essentially zero ongoing maintenance — point it at a domain name and a local port, and it handles the ACME challenge, certificate storage, and renewal timer itself, including reloading without dropping existing connections. This avoids the classic self-hosting failure mode of "certbot renewal cron job silently breaks eight months later" that plain certbot setups are prone to on lightly-maintained boxes.
- Once Caddy has TLS on the public hostname, it can either terminate TLS and reverse-proxy the WebSocket upgrade to `wt-tracker`'s configured `ws://` port on localhost, or you can have `wt-tracker` listen with `wss` directly if you'd rather not add Caddy as a hop — the two-hop version (Caddy terminates, `wt-tracker` speaks plain `ws` internally) is the more common, easier-to-maintain pattern and is what's recommended here.

### Path B: Cloudflare Tunnel (avoids owning TLS/cert lifecycle at all)

Cloudflare Tunnel runs a small daemon (`cloudflared`) on the VM that opens an *outbound* connection to Cloudflare's edge — no inbound port ever needs to be opened on the VM's firewall, and Cloudflare terminates TLS on its own edge using its own certificate, so there's no Let's Encrypt renewal to think about at all on your end. WebSocket traffic over a Cloudflare Tunnel public hostname is a supported, documented pattern (used in production for things like Laravel Reverb/WebSocket apps) as long as it's configured as one public hostname mapped to the internal service — the reported failure mode in Cloudflare's own issue tracker is specifically about exposing *multiple* nonstandard ports through one tunnel, which doesn't apply to a single `wss://tracker.yourdomain.tld` endpoint.

- Still requires a domain, but the domain's DNS needs to be managed through Cloudflare specifically (Cloudflare's free tier covers this) rather than the registrar's own DNS.
- Removes the "did the cert renew" maintenance question entirely, at the cost of routing tracker traffic through Cloudflare's network and depending on Cloudflare's tunnel infrastructure staying up — a reasonable trade for a project of this size.

### Recommendation

Either path is legitimate; Path B (Cloudflare Tunnel) is the lower-maintenance-burden choice specifically because it removes TLS renewal as an ongoing chore, which matters more than usual given the project's own stated priority of minimizing infrastructure to maintain. Path A (Caddy) is preferable only if there's a reason to avoid routing tracker traffic through a third party's network. Either way, budget for owning one small annual domain cost — there's no way to get a trusted `wss://` certificate without a real domain name pointed somewhere.

---

## 4. Wiring a self-hosted tracker into p2p-media-loader

This is a small, well-documented config change, confirmed directly against Novage/p2p-media-loader's own FAQ:

```js
const config = {
  loader: {
    trackerAnnounce: [
      "wss://tracker.yourdomain.tld"
      // additional tracker URLs can be listed for redundancy
    ],
    rtcConfig: {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" }
        // STUN servers are a separate concern from trackers — public STUN
        // is fine to keep, per the April-2026 WebRTC testing already in
        // cytube-knowledge; this doc is about the tracker specifically
      ]
    }
  }
};
```

By default (no `trackerAnnounce` override), p2p-media-loader ships pointed at public trackers — specifically `openwebtorrent.com` and Novage's own `tracker.novage.com.ua` are the two named in the library's own documentation as the built-in defaults. This confirms the WS-081 privacy concern precisely: out of the box, with zero configuration, every peer's signaling (and therefore IP address, via the WebRTC connection each peer then makes) is announced to a tracker anyone else in the world can also point a WebTorrent-compatible client at, if they can guess or discover the swarm ID.

**Swarm ID scoping — this is the actual privacy lever, separate from "self-hosted vs. public":**

- By default, the swarm ID p2p-media-loader announces to the tracker is derived automatically from the stream's master manifest URL (minus query parameters). For HiveStream's case — content is likely served from a shared/predictable HLS origin path per video, not a unique-per-room URL — this default would mean **every CyTube room watching the same underlying video file ends up in the same swarm**, announced under the same identifiable ID, regardless of tracker choice. That's the wrong scope for a room-based privacy model even on a private tracker.
- p2p-media-loader exposes a `swarmId` config field specifically to override this: `segments: { swarmId: "any-unique-string" }`. This should be set to something derived from the CyTube room's own identity (e.g. a hash of the room name plus something room-session-scoped, depending on exactly how much cross-session persistence is wanted per the project's "persistent reuse" thesis — this is a real design decision, not just plumbing, and connects directly to the "media identity" open item already flagged in the project's architecture notes: `streamSwarmId`/`infoHash` construction should account for room scoping, not just content identity).
- **Practical implication:** self-hosting the tracker without also setting a room-scoped `swarmId` only solves half the privacy problem — it stops *strangers on the public internet* from finding room members' peer connections, but if the swarm ID stays content-derived, different CyTube rooms watching the same video would still be in the same swarm as each other on your own tracker. Whether that's actually a problem depends on whether "channel members from different rooms watching the same rerun shouldn't be able to see each other's peer connections" is a real requirement — worth deciding explicitly rather than leaving as a default. Given HiveStream's core rewatch-bandwidth thesis actually *wants* independently-sourced copies of the same episode to converge into one swarm for efficiency, there may be a real tension here between "privacy-scope swarms per room" and "efficiency-scope swarms per content" that's worth its own short design note before implementation, rather than assuming a single `swarmId` scheme trivially satisfies both goals.

---

## 5. Cost and maintenance burden, weighed honestly against the privacy rationale

**Cost, realistic ranges:**
- Hosting: $0/month (Oracle or GCP always-free) to ~$4-5/month (small VPS).
- Domain: roughly $2-15/year, effectively $0.20-1.25/month amortized.
- TLS: $0 either path (Let's Encrypt via Caddy, or Cloudflare's own cert) — no recurring cost, but see maintenance below.
- **Total realistic range: $0-6/month**, i.e. this is not a budget-driving decision either way.

**Maintenance burden, honestly:**
- One-time setup: provisioning the VM, installing Node, cloning and configuring `wt-tracker`, setting up the reverse proxy/tunnel and DNS — call it an evening's work the first time, done entirely over SSH from Termux, no desktop needed.
- Ongoing, if using Caddy: essentially none — Caddy's automatic renewal is one of the more reliable pieces of infrastructure in this stack precisely because it was designed to eliminate the "forgot to renew" failure mode that plagues raw certbot setups.
- Ongoing, if using Cloudflare Tunnel: even less — no cert lifecycle to think about at all, though the `cloudflared` daemon itself needs occasional updates like any other package.
- Ongoing, either way: `wt-tracker`/Node dependency updates from time to time (standard npm-ecosystem hygiene, no different in kind from maintaining HiveStream's own client-side dependencies), and keeping an eye on the VM itself (OS security updates) — this is real but low-frequency work, not a standing operational burden.
- Risk of silent failure: a tracker outage doesn't break existing playback (the FAQ confirms p2p-media-loader falls back to normal HTTP(S) delivery with no worse performance than a non-P2P player when peers/trackers aren't reachable) — it just silently reduces the app to "no P2P benefit today" rather than causing a visible outage. That's a forgiving failure mode for a side project: nothing breaks loudly if the tracker VM has an off week.

**Weighed against the privacy rationale:**

The concern this whole exercise addresses is real and not overstated: a WebRTC signaling handshake, by its nature, requires exposing enough connection information (ICE candidates, which include IP addresses) for two peers to establish a direct connection. On a public tracker with a guessable or content-derived swarm ID, that means anyone running any WebTorrent-compatible client, anywhere, who can guess or discover the swarm ID for a video being watched in a CyTube room, can announce to the same tracker, receive that swarm's peer list, and attempt to connect directly to room members' IP addresses — people who never opted into being discoverable by anyone outside their own room. That's a meaningfully different privacy posture than "the origin server sees my IP" (ordinary, expected of any client-server request) — it's "strangers with no relationship to this room can be handed a live list of who's currently in it and how to reach them directly."

Given that:
- the actual cost is low enough to not be a real constraint at this project's scale ($0-6/month),
- the tracker software is already built, mature, and vastly over-provisioned relative to need (Section 1),
- the maintenance burden, especially with Caddy or Cloudflare Tunnel, is genuinely low after initial setup, and
- the alternative (ship with public trackers now, "fix it later") means every day of real usage between "public tracker" and "self-hosted" is a day where this specific privacy exposure is live for anyone who actually uses the feature —

DEC-000's recommendation to make this a day-one requirement rather than a deferred upgrade holds up under this closer look. The honest caveat is that this whole exercise only matters once P2P is actually being tested with more than one real device/peer talking to a tracker — for solo Phase-1 development work where the two-browser proof is running against a single developer's own connections, the exposure is close to theoretical. The natural trigger point is: stand up the self-hosted tracker before the first time anyone other than you connects to a live swarm, not necessarily before writing a single line of Phase-1 code.

---

## 6. Simpler middle-ground options

Looked for honestly, and the answer is disappointing but clear: **there isn't a hosted/managed private-tracker-as-a-service option that doesn't undermine the privacy goal**, because the entire category of "public WebTorrent tracker" is public and shared by design — that's what makes it free and zero-setup, and it's also exactly the property being avoided. A few adjacent things worth naming so they're not silently missed, each with why it doesn't actually solve this:

- **Public trackers, including ones from BitTorrent-adjacent hosting communities** (e.g. `peerhub.net`-style regional public trackers referenced in some `wt-tracker` forks): these are just more instances of the same public-tracker category — no access control, no privacy improvement over `openwebtorrent.com`.
- **`tracker.novage.com.ua`** (Novage's own public tracker, one of p2p-media-loader's two documented defaults): notable only in that it's the tracker author's own hosted instance, which might imply slightly better reliability than a community-run one like `openwebtorrent.com` — genuinely reported elsewhere as flaky/overloaded, being one of few public options — but it's still a fully public, unauthenticated tracker. No privacy improvement.
- **Running the tracker only accessible over something like a VPN or Tailscale** rather than the public internet: this would technically add access control, but it doesn't fit HiveStream's use case — CyTube room members are ordinary browser users connecting from wherever they are, not devices on a shared private network, so this isn't actually a viable middle ground here (unlike, say, a family media server).
- **Skipping a tracker-based approach in favor of a fully server-mediated signaling relay** (i.e., have your own CyTube-adjacent server relay SDP offers between room members directly, instead of speaking the WebTorrent tracker protocol at all): this is a real architectural alternative, not a middle ground on hosting cost, since it would still need a small always-on server process — just one that doesn't use the WebTorrent tracker protocol at all. It would arguably give even *tighter* room-scoping (the signaling relay could be built to only ever pair peers within the same CyTube room, with no swarm ID scheme needed), but it would mean writing custom signaling logic instead of reusing p2p-media-loader's existing tracker-protocol integration, so it trades "reuse a well-tested library's client-side tracker code" for "own more of the signaling stack yourself." Worth flagging as a real option if the swarm ID room-scoping question in Section 4 turns out to be genuinely awkward to solve within p2p-media-loader's model, but not recommended as a starting point — it reopens exactly the kind of "don't reinvent what a mature library already does" question the project has otherwise been disciplined about avoiding.

**Bottom line:** self-hosting via `wt-tracker` on a free or near-free always-on VM, with a room-scoped `swarmId`, is not just the safest option — given the honest survey above, it's close to the *only* option that actually satisfies the stated privacy goal. There's no lower-effort substitute hiding in the ecosystem; the effort here already is the low-effort path.

---

## Sources referenced

- `webtorrent/bittorrent-tracker` — GitHub repo, README, releases, and Issue #354 (WebSocket tracker scaling design discussion)
- `Novage/wt-tracker` — GitHub repo and README
- `Novage/p2p-media-loader` — FAQ.md (default trackers, `trackerAnnounce`/`swarmId` config, swarm-membership requirements, HTTP(S) fallback behavior) and root README (default public tracker/STUN list)
- `npmjs.com/package/p2p-media-loader-hlsjs` — Engine settings reference (`swarmId` field description)
- `npmjs.com/package/uwt` — µWebTorrentTracker package description
- Oracle Cloud Infrastructure Free Tier documentation and several independent 2026 write-ups on the June 2026 Ampere A1 allocation reduction and signup/capacity friction
- Independent 2026 write-ups on Google Cloud's Always Free `e2-micro` allocation and regional/egress limits
- Independent 2026 VPS-pricing comparisons (Hetzner, Contabo, InterServer, DigitalOcean, Vultr)
- Fly.io / Render free-tier comparisons (`DmitryScaletta/free-heroku-alternatives`) and independent 2026 Fly.io pricing write-ups (flagged in this doc as inconsistent/unverified — confirm directly before relying on)
- Cloudflare Tunnel documentation and community write-ups on WebSocket support over tunnels, including a relevant `cloudflared` GitHub issue on multi-port tunnel limitations
- `en.wikipedia.org/wiki/OpenBitTorrent` — background on public-tracker reliability/history
- `OpenWebTorrent/openwebtorrent-tracker` GitHub issue — reported reliability problems with the public `tracker.openwebtorrent.com` instance specifically
