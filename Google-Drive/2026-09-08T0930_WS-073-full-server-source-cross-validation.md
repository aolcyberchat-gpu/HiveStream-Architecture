# WS-073 — Full Server-Source Cross-Validation (calzoneman/sync)

**Source:** `calzoneman/sync` — the actual open-source CyTube server (Node.js),
https://github.com/calzoneman/sync. This document cross-checks every prior
runtime-scraped finding in `duckwerks/cytube-knowledge` against the
authoritative server source, and catalogs everything new that only the
server source reveals.

This repo should be treated as a standing reference from now on, not a
one-off lookup. `src/channel/*.js` implements every per-channel module;
`www/js/*.js` is the exact same client bundle (callbacks.js, ui.js,
util.js, player.js) already being reverse-engineered live.

---

## 1. Rank / Leader / Permission system — CONFIRMED + EXTENDED

### 1a. Permission threshold table — WS-068 confirmed exactly
`src/channel/permissions.js`'s `DEFAULT_PERMISSIONS` object matches the
live-scraped `CHANNEL.perms` from WS-068 key-for-key, value-for-value.
No drift observed on the tested channel.

### 1b. Rank scale — WS-071 confirmed exactly, extended with rank 4
`src/channel/ranks.js`'s `handleRankChange` enforces: a user can only
set another user's rank to a value strictly less than their own
`effectiveRank` — **except** a rank-4 user may set another user to rank
4 as well (`!(userrank === 4 && rank === 4)`). This confirms a **5th
tier above "Channel Admin" (3)**: rank 4, i.e. **Channel Owner**. This
resolves the open question from WS-072 about the unaccounted `+Owner`
button in the Moderators panel.

Full confirmed scale:
| Rank | Name |
|---|---|
| -1 | Anonymous |
| 0 | Guest |
| 1 | Registered |
| 1.5 | Leader (temporary, see 1c) |
| 2 | Moderator |
| 3 | Channel Admin |
| 4 | Channel Owner |
| 1000000 | Nobody (sentinel, unreachable) |

### 1c. Leader grant mechanism — WS-071 confirmed, mechanism fully exposed
`src/channel/playlist.js` `handleAssignLeader` (not `ranks.js` — leader
lives in the playlist module):
- Gated by `canAssignLeader` = `hasPermission(user, "leaderctl")`
  (rank >= 2). Violating this **kicks** the user
  (`"Attempted assignLeader without sufficient permission"`) — not a
  silent no-op.
- Granting leader to a user whose `effectiveRank < 1.5`: their
  `effectiveRank` is bumped to exactly `1.5`, their real rank is stashed
  in `account.oldRank`, and both `effectiveRankChange` and `rank` events
  fire to update their client.
- Revoking leader restores `effectiveRank` from `oldRank` **only if**
  their current `effectiveRank === 1.5` (i.e. it won't clobber a rank
  that changed some other way while they were leader).
- Passing an empty name calls `resumeAutolead()`, which broadcasts
  `setLeader` with an empty string to clear leader channel-wide.

### 1d. effectiveRank formula — NEW, not previously known
`effectiveRank = Math.max(globalRank, channelRank)` (from `ranks.js`).
Rank is not a single stored number — it's the higher of a user's
site-wide global rank and their per-channel rank. A site-registered
user with no channel-specific rank still gets their global rank; a
locally-promoted user gets whichever is higher.

### 1e. setChannelRank server-side validation — extends WS-072
`ranks.js` `handleRankChange`:
- Requires `effectiveRank >= 3` to change **any** rank.
- Rejects self-promotion/demotion.
- Rejects targeting a user with rank >= your own (with the rank-4
  exception above).
- In unregistered channels, the target user must be online (rank
  changes aren't persisted there).
- On success: `receiver.socket.emit("rank", ...)` (private, to the
  target only) **and** `channel.broadcastAll("setUserRank", data)`
  (public, to everyone) — two separate events, not one.

---

## 2. CSS/JS/MOTD customization — extends WS-030

`src/channel/customization.js`:
- `canSetCSS` / `canSetJS` both require `effectiveRank >= 3` — directly
  confirms WS-030's finding that channel JS/CSS is admin-gated.
  Violation **kicks** the user (not a silent rejection).
- Both CSS and JS are **truncated to 20,000 characters** server-side
  (`data.css.substring(0, 20000)`) — a previously-unknown hard limit.
- Change detection uses an **MD5 hash** of the content (`cssHash`/
  `jsHash`, via a `hash('md5', val, 'base64')` helper) — this is
  exactly the `cssHash` field referenced in WS-030's `channelCSSJS`
  event payload, now with its origin confirmed.
- MOTD is separately gated by `canEditMotd` (rank >= 3) and is run
  through `XSS.sanitizeHTML()` both on save and on load (re-sanitized
  in case filter rules changed since it was stored).

---

## 3. Full server-side socket event catalog (NEW — most complete map yet)

This is a complete inbound/outbound event map, pulled directly from
every `src/channel/*.js` module. It is more complete and more reliable
than the client-only catalogs in WS-028/WS-029, since it comes from the
code that actually registers/emits each event, not just observed
client callback names.

### Inbound (client → server), by module
| Module | Events |
|---|---|
| accesscontrol.js | channelPassword, disconnect |
| anonymouscheck.js | disconnect |
| channel.js | disconnect, readChanLog |
| chat.js | chatMsg, pm |
| customization.js | setChannelCSS, setChannelJS, setMotd |
| emotes.js | importEmotes, moveEmote, removeEmote, renameEmote, updateEmote |
| filters.js | addFilter, importFilters, moveFilter, removeFilter, requestChatFilters, updateFilter |
| kickban.js | requestBanlist, unban |
| library.js | searchMedia, uncache |
| opts.js | setOptions |
| permissions.js | setPermissions, togglePlaylistLock |
| playlist.js | assignLeader, clearPlaylist, clonePlaylist, delete, deletePlaylist, jumpTo, listPlaylists, mediaUpdate, moveMedia, playNext, playerReady, queue, queuePlaylist, requestPlaylist, setTemp, shufflePlaylist |
| poll.js | closePoll, newPoll, vote |
| ranks.js | requestChannelRanks, setChannelRank |
| voteskip.js | voteskip |

### Outbound (server → client), by module
| Module | Events |
|---|---|
| accesscontrol.js | cancelNeedPassword, needPassword |
| anonymouscheck.js | errorMsg |
| channel.js | addUser, channelNotRegistered, clearFlag, empty, loadFail, readChanLog, setAFK, setFlag, setLeader, setUserMeta, setUserProfile, setUserRank, userLeave, usercount, userlist, warnLargeChandump |
| chat.js | chatMsg, clearchat, cooldown, errorMsg, noflood, pm, spamFiltered |
| customization.js | channelCSSJS, setMotd |
| drink.js | drinkCount |
| emotes.js | emoteList, errorMsg, removeEmote, renameEmote, updateEmote |
| filters.js | addFilterSuccess, chatFilters, deleteChatFilter, errorMsg, updateChatFilter |
| kickban.js | banlist, banlistRemove, costanza, errorMsg |
| library.js | searchResults |
| opts.js | channelOpts, errorMsg, validationError, validationPassed |
| permissions.js | setPermissions, setPlaylistLocked |
| playlist.js | changeMedia, delete, effectiveRankChange, errorMsg, listPlaylists, mediaUpdate, moveVideo, playlist, queue, queueFail, queueWarn, rank, setCurrent, setLeader, setPlaylistMeta, setTemp, setUserRank |
| poll.js | closePoll, newPoll, updatePoll |
| ranks.js | channelRankFail, channelRanks, effectiveRankChange, noflood, rank, setUserRank |
| voteskip.js | voteskip |

Notable: `setLeader`, `setUserRank`, and `rank` each fire from **more
than one module** (leader lifecycle touches both `playlist.js` and
`ranks.js`) — worth remembering when tracing an event back to its
source in future tests.

---

## 4. Cross-validation verdict summary

| Prior finding | Verdict |
|---|---|
| WS-030 (channelCSSJS gating) | Confirmed, extended (20k char limit, MD5 hash mechanism) |
| WS-068 (permission table) | Confirmed exactly, no drift |
| WS-069 (setChannelRank exists) | Confirmed, full validation logic now known |
| WS-071 (rank/leader scale, assignLeader/setLeader) | Confirmed exactly, extended (rank 4, effectiveRank formula) |
| WS-072 (setChannelRank, +Owner mystery) | Owner = rank 4, confirmed |

## 5. Still open (even with server source)
- Runtime-only behaviors that depend on live state (e.g. exact
  autolead re-election order, timing of `_leadInterval`) are best
  confirmed by a live test now that the code path is known — this
  moves those tests from *exploratory* to *targeted verification*.
- Database-layer specifics (`db.channels.setRank`, `Account.rankForName`)
  live outside `src/channel/` and weren't scanned in this pass.
