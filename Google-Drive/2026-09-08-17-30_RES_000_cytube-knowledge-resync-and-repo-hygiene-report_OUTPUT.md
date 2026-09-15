# Resync Report — `duckwerks/cytube-knowledge` vs `calzoneman/sync` + repo hygiene pass

**Authors:** Ed (project owner — Termux/Kiwi reverse-engineering, GitHub knowledge base curator) & Claude (Anthropic — cloned and cross-referenced `duckwerks/cytube-knowledge` against `calzoneman/sync` server source)

**Date:** 2026-09-08
**Scope:** Cloned and read `duckwerks/cytube-knowledge` and `calzoneman/sync` directly (not the empty uploaded doc stubs, which had no content in this session). Cross-checked open questions in the knowledge repo against actual server source, and audited the repo for internal consistency.

---

## 1. BIGGEST FINDING — the leader/playNext protocol is now fully closed, with one correction

The knowledge repo's WS-067 → WS-073 arc built up client-side evidence that `CLIENT.leader` gates whether the *client itself* emits `playNext` on media end, and WS-072/WS-073 got runtime confirmation of the `assignLeader` → `setLeader` round trip. WS-072 explicitly flagged `"serverSourceCodeProven": false` — the server implementation was still unseen.

`calzoneman/sync` (`src/channel/playlist.js`, `src/channel/permissions.js`) closes that gap. Confirmed server-side facts:

- **`assignLeader` is gated by `leaderctl`** (rank ≥ 2), via `PermissionsModule.canAssignLeader`. An unauthorized attempt gets the user **kicked**, not just ignored:
  ```js
  PlaylistModule.prototype.handleAssignLeader = function (user, data) {
      if (!this.channel.modules.permissions.canAssignLeader(user)) {
          return user.kick("Attempted assignLeader without sufficient permission");
      }
  ```
- **Becoming leader temporarily borrows rank 1.5** if the user's `effectiveRank` is below that, and it's given back (`oldRank`) when leader is removed. This is why WS-072's test subject (rank 5) didn't need the borrow — it only triggers for users below 1.5.
- **The correction to fold in:** `handlePlayNext` (server) does **not** check `CLIENT.leader` or `leaderctl` at all. It checks:
  ```js
  PlaylistModule.prototype.handlePlayNext = function (user) {
      if (!this.channel.modules.permissions.canSkipVideo(user)) return;
      ...
  };
  // canSkipVideo -> hasPermission(account, "playlistjump")  // rank >= 1.5
  ```
  So **any user at rank ≥ 1.5 can call `playNext` directly, whether or not they are "leader."** Being leader is *sufficient* (it borrows you up to 1.5) but not *necessary* for server-side skip authorization. The client's own `if (CLIENT.leader) socket.emit('playNext')` in `player.js` is a client-side UX gate (only the leader's player should be driving auto-advance so non-leaders don't all fire duplicate skips), not the server's actual authorization boundary. These are two different rules that happen to overlap for leaders.
- **Leader removal / autolead**: confirmed exactly as WS-073 inferred — `resumeAutolead()` broadcasts `setLeader("")`, unpauses, and restarts the server-side `_leadInterval` timer if one isn't already running.

**Action:** WS-069 through WS-073 never got a `-FINDINGS.md` (unlike WS-062–068, which each got one). This whole arc should be closed out with a single `WS-073-CYTUBE-LEADER-LIFECYCLE-FINDINGS.md` that states the confirmed client↔server protocol end-to-end and explicitly documents the `playlistjump` vs `leaderctl` distinction above, upgrading `serverSourceCodeProven` from `false`/inferred to **proven** for the whole arc.

---

## 2. Repo hygiene issues found (all independently verified by reading the files)

| Issue | Detail | Fix |
|---|---|---|
| **WS-073 number reused twice** | `2026-09-07T1330_WS-073-CYTUBE-LEADER-REMOVAL-AUTOLEAD-RUNTIME-TRACE-TEST.js` and `2026-09-07T2003_WS-073-P2P-MEDIA-LOADER-RUNTIME-DISCOVERY-TEST.js` are two unrelated tests sharing WS-073 on the same day. | Renumber the P2P media loader one to **WS-074** (leave the leader test alone since its header text and WS-072 already reference it as WS-073). |
| **WS-071 has a mislabeled combined artifact** | `WS-071-CYTUBE-LEADER-PERMISSION-CONTROL-SOURCE-SCAN-TEST.js.md` (200KB) is not markdown — it's the script header + raw JSON output concatenated, saved with a double extension. This breaks your own three-artifact rule (script / output / findings) in `TEST-ARTIFACT-CREATION-STANDARD.md`. | Split it: keep the script portion only if it differs from the clean `WS-071-...-TEST.js`, and rename the output portion to `WS-071-TEST-OUTPUT.txt` per your standard. |
| **Test outputs saved as `.js` instead of `.txt`** | Your own standard specifies `WS-0xx-TEST-OUTPUT.txt` for captured runtime output, but WS-069/070/071/072/073's outputs are all saved as `2026-09-07T....js` — indistinguishable by extension from the executable scripts. | Cosmetic but worth fixing before the pattern compounds — rename dated output files to `.txt` or add `-OUTPUT` to the filename. |
| **Missing FINDINGS.md for the leader arc** | WS-062 through WS-068 each have a `-FINDINGS.md`. WS-069–073 do not. | Write the consolidated findings file described in §1. |
| **`REPO-INDEX-Cytube-project-repo-map.md` (2026-09-05) is stale** | It still lists the `aolcyberchat-gpu/P2P-Theater-Core` vs `backwater-battery/cytube-hivestream` relationship as an **open, unresolved question** ("possible duplicate, fork, or divergent copy; needs diffing"), and even has the activity level backwards (it describes `backwater-battery/cytube-hivestream` as the more actively iterated 13-version lineage). Your memory/notes have since resolved this: `aolcyberchat-gpu/P2P-Theater-Core` is canonical (~50 iterations, active); `backwater-battery/cytube-hivestream` is the abandoned parallel restart. | Update or replace this file so a future LLM session reading the repo doesn't re-litigate an already-solved question. |
| **The duplicate DOM/WebSocket research file is a trivial, safe merge** | See §3 below — resolved, not just flagged. | Do the 165-line append described below. |

---

## 3. Resolved: the diverged `cytube websocket and dom structure.txt` duplicate

Cloned `backwater-battery/cytube-hivestream` to do the actual diff (this was listed as a known open task in memory). Result:

- The two files are **byte-identical for their entire shared body**. No conflicting findings — nothing to reconcile.
- `backwater-battery`'s copy has two things `duckwerks`' copy doesn't:
  1. An 8-line conversational preamble at the very top (the original mobile-workflow instructions to the LLM) — low value, skip it.
  2. **165 extra lines at the end** that `duckwerks`' `2026-04-07_cytube websocket and dom structure.txt` is missing — additional Termux `curl` scrape sessions covering:
     - WebTorrent's bundled `iceServers`/STUN config, `createDataChannel` usage, and RTC signaling type strings (`"offer"`/`"answer"`/`"candidate"`) pulled straight from `webtorrent.min.js` via jsDelivr — directly relevant to the HiveStream P2P work.
     - `formatChatMessage`, `addChatMessage`, and `#messagebuffer` DOM-append patterns from `util.js`/`callbacks.js`/`ui.js` — chat rendering internals not otherwise captured in your DOM-00x files.

**This is a pure append, not a real merge conflict.** The missing 165-line block was extracted to `merge_tail_block.txt` — the fix is to append it to the end of `duckwerks/cytube-knowledge/2026-04-07_cytube websocket and dom structure.txt` and then treat `backwater-battery`'s copy as fully superseded/deletable.

---

## 4. Something more important than any of the above: an architecture pivot that isn't in memory yet

Reading `HIVESTREAM-P2P-ENGINE-ARCHITECTURE-DECISION-2026-09-08.md`, `HIVESTREAM-IMPLEMENTATION-ROADMAP-AND-OPEN-QUESTIONS-2026-09-08.md`, and `HIVESTREAM-LLM-HANDOFF-2026-09-08.md` (all dated 2026-09-08, all authored with a different assistant — "GPT-5.6 Luna (OpenAI)" — as the credited research/engineering AI):

> **Decision: use Novage `p2p-media-loader` as the HiveStream media-plane engine. Do not use WebTorrent as the core media architecture. Do not build a new P2P media protocol.**

This directly supersedes the WebTorrent-based approach that `P2P-Theater-Core` (marked "canonical" and "actively developed" in Claude's stored memory of this project) is built on. The new docs frame this as a rename/reboot too — the project is now referred to as **HiveStream** as the umbrella name, not `P2P-Theater-Core`, with a `MediaDistribution` abstraction layer planned so the transport (currently p2p-media-loader) stays swappable, and CyTube's leader/rank state deliberately reused as the coordination authority rather than inventing a second one (this last point is consistent with, and actually validated by, the leader-protocol findings in §1).

Flagged rather than quietly acted on: Claude's stored memory of this project (P2P-Theater-Core/WebTorrent as canonical) is now behind what's actually in the knowledge repo. Awaiting confirmation on whether to update memory to reflect the HiveStream/p2p-media-loader pivot.

---

## 5. What did not show any problem

- The WS-028/WS-029 inbound/outbound Socket.IO event catalogs and WS-030 (`channelCSSJS` → `checkScriptAccess()` → `JSPREF` → `localStorage['channel_js_pref']`) — nothing in `calzoneman/sync`'s client bundle (`www/js/*`) contradicts these; they read as accurate.
- The rank/permission threshold table in WS-068 matches `src/channel/permissions.js`'s defaults exactly (`playlistjump: 1.5`, `playlistdelete: 2`, `leaderctl: 2`, `seeplaylist: -1`, etc.) — no drift there.

---

## Suggested next actions, in order

1. Confirm whether to write the leader-arc FINDINGS.md now (citing the exact `calzoneman/sync` line numbers above).
2. Confirm whether to fold the 165-line WebTorrent/chat-DOM block into the canonical DOM/WS file, and whether to delete `backwater-battery`'s duplicate afterward.
3. Confirm whether the HiveStream/p2p-media-loader pivot should be written into memory now.
4. Confirm the WS-073 renumber + WS-071 output split + REPO-INDEX.md refresh as one batch, formatted for pasting via Markor.
