# WS-074 — Chat, Emotes, Filters, Moderation, Library, Options, Poll,
# Voteskip & Drink: Full Server-Source Findings

**Authors:** Ed (project owner — Termux/Kiwi reverse-engineering, GitHub
knowledge base curator) & Claude (Anthropic — source analysis of
`calzoneman/sync`)

**Purpose of this document:** This is a reference artifact for the
`duckwerks/cytube-knowledge` project. Its goal is to let any LLM (Claude,
ChatGPT, or otherwise) working on Ed's CyTube room/channel scripts
understand, without re-deriving it from scratch, exactly how nine core
CyTube server modules work — their socket events, permission gates,
validation rules, and hard limits. This complements the earlier
`WS-030`, `WS-068` through `WS-073` findings (rank/permission/leader
system) with the remaining major channel modules.

**Source:** `calzoneman/sync` (https://github.com/calzoneman/sync),
`src/channel/{chat,emotes,filters,kickban,library,opts,poll,voteskip,
drink}.js` — this is the actual open-source CyTube server, so everything
below is ground truth, not inferred from client-side scraping.

**Why this matters for "one-shotting" new rooms:** every socket event
name, payload shape, and permission threshold below is exactly what a
custom userscript needs to correctly listen for server events or safely
emit client requests, without guessing or trial-and-error against a live
room.

---

## 1. Chat (`chat.js`)

### Core flow
`chatMsg` (inbound) → `handleChatMsg` → permission check
(`canChat`, rank >= 0) → message truncated to
`Config.get("max-chat-message-length")` → new-account/new-IP
restriction check → blank-message rejection → control-character
stripping (unless `allow_ascii_control` option is on) →
`onUserPreChat` module hook (this is the extension point `drink.js`
uses to hijack `/d` messages) → `processChatMsg` → domain-blacklist
kick check → AFK-clear (unless message starts with `/afk`) →
antiflood throttle → slash-command dispatch → shadow-mute /
mute check → `sendMessage` → `channel.broadcastAll("chatMsg", msgobj)`.

### Built-in slash commands (registered via `registerCommand`)
| Command | Effect | Gate |
|---|---|---|
| `/me <text>` | action-styled message (`meta.action = true`) | none (just chat perm) |
| `/sp <text>` | spoiler-styled message | none |
| `/say`, `/rcv`, `/shout` | "shout" styled message, forces name display | `effectiveRank >= 1.5` |
| `/clear` | wipes the chat buffer for everyone | `canClearChat` (rank 2 per WS-068) |
| `/a <text>` | superadmin flair message, supports `!icon-X`/`!label-X` args | `account.globalRank >= 255` (superadmin only — separate from channel rank) |
| `/afk` | toggles AFK flag | none |
| `/mute <name>` | mutes a user (chat suppressed, still visible to mods) | `canMute` (1.5), AND target's rank must be strictly lower than actor's |
| `/smute <name>` | shadow-mutes (target can't tell they're muted — see below) | same as `/mute` |
| `/unmute`, `/unsmute <name>` | un-mutes | `canMute`; **cannot target yourself** |

### Mute vs. shadow-mute — important distinction for any custom chat UI
- **Muted** (`Flags.U_MUTED`): message is rejected server-side, sender
  gets a `noflood` event with `{action: "chat", msg: "You have been
  muted..."}`. Sender knows they're muted.
- **Shadow-muted** (`Flags.U_MUTED | Flags.U_SMUTED`): the message
  object IS broadcast, but **only** to: (a) other shadow-muted/
  anonymous users (so the muted user sees their own message appear
  normally and can't tell), and (b) moderators (who see it flagged
  `meta.shadow = true`). A custom chat script should be aware that
  `meta.shadow: true` messages are only visible to a subset of the room
  — don't assume every client sees every `chatMsg`.

### PM (`pm`, inbound/outbound)
Requires login (`Flags.U_LOGGED_IN`). Same new-account/link restriction
and domain-blacklist-kick logic as public chat. Blocks self-PM. Rejects
invalid usernames and offline targets with `errorMsg`. Uses a
**separate, stricter antiflood limiter** (`MIN_ANTIFLOOD`: burst 20,
sustained 10 msg/sec — fixed, not configurable) vs. public chat's
antiflood which is configurable per-channel via `chat_antiflood_params`.

### Message formatting pipeline (`formatMessage`)
`XSS.sanitizeText(msg)` → filter pipeline (see Filters section below,
skipped for URLs which are placeholder-swapped first) →
`XSS.sanitizeHTML(result)`. Any custom rendering script consuming
`chatMsg` payloads should assume the `msg` field has already been
through this full sanitize+filter+re-sanitize pipeline server-side.

### Rate limiting
Default antiflood (always applied to PMs, and to public chat when
`chat_antiflood` option is off): burst 20 / sustained 10 msg/sec. When
`chat_antiflood` is enabled (typically for lower-rank users, since the
option only kicks in for `effectiveRank < 2`): configurable
`chat_antiflood_params` (default burst 4, sustained 1/sec, cooldown 4s —
see Options section). On throttle, emits `cooldown` with the ms delay
until the next allowed message.

---

## 2. Emotes (`emotes.js`)

Each emote is `{name, image, source}` where `source` is
auto-derived from `name`: `(^|\s)` + escaped-name + `(?!\S)` — i.e. an
emote only matches as a **whole word** bounded by whitespace/string
edges, not inside other words. `image` is capped at 1000 chars.

Two distinct permission tiers, both extending WS-068's table:
- **Edit** (`canEditEmotes`) — rename/update/remove/move a single emote.
- **Import** (`canImportEmotes`) — bulk-replace the entire emote list.
  Deliberately a *different, typically higher* permission node than
  edit — a channel could let mods edit individual emotes but reserve
  bulk import for admins.

`renameEmote` and `updateEmote` reject on validation failure (blank
name/image, invalid regex, or duplicate name) with an `errorMsg` +
`alert: true` (client should show a blocking alert, not a toast).
`moveEmote` does a list-reorder by index, silently no-ops on
out-of-range indices.

---

## 3. Chat filters (`filters.js`)

Filters are regex find/replace rules applied to chat messages (see
Chat section's `formatMessage` pipeline). Uses PCRE-style `\1`/`\2`
backreferences internally — inputs given as JS-style `$1`/`$2` are
auto-converted (`fixReplace`).

**Default filters shipped on every new channel** (markdown-lite):
| Name | Pattern | Replaces with |
|---|---|---|
| monospace | `` `(.+?)` `` | `<code>$1</code>` |
| bold | `\*(.+?)\*` | `<strong>$1</strong>` |
| italic | `_(.+?)_` | `<em>$1</em>` |
| strike | `~~(.+?)~~` | `<s>$1</s>` |
| inline spoiler | `\[sp\](.*?)\[/sp\]` | `<span class="spoiler">$1</span>` |

A filter can optionally set `filterlinks: true` to also apply inside
URLs (normally URLs are protected from filtering via a placeholder-swap
in `chat.js`). `replace` capped at 1000 chars.

Same edit-vs-import permission split as emotes (`canEditFilters` vs.
`canImportFilters`). `addFilter`/`updateFilter` validate the regex via
`FilterList.checkValidRegex` server-side before accepting — invalid
regex gets rejected with an `errorMsg`, not silently dropped.

---

## 4. Kick / Ban (`kickban.js`)

### Commands (chat-registered, not raw socket events for the actor side)
`/kick <name> [reason]`, `/kickanons`, `/ban <name> [reason]`,
`/ipban <name> [range|wrange] [reason]` (`/banip` is an alias).

### The universal targeting rule (also seen in `/mute`, `/smute` above)
Every moderation action enforces: **you cannot act on a user whose
`effectiveRank >= yours`, or whose `globalRank > yours`.** This exact
same guard appears independently in kick, ban, mute, and smute — treat
it as a general CyTube moderation invariant, not a per-feature rule.

### Ban granularity
- `banName` — bans by name only (`ip: "*"` in the DB record).
- `banIP` — bans a specific IP (masked/cloaked in logs and in the
  banlist sent to non-superadmins — `util.cloakIP`).
- `banAll` — the actual `/ipban` handler: looks up **all known IPs**
  ever associated with that name (`dbGetIPs`), then bans each one
  (optionally widened to a `/24`-style `range` or wider `wrange`), plus
  a name-ban as a backstop.
- Self-ban is explicitly blocked (`costanza` event — a CyTube in-joke
  event name for "you can't do that to yourself").
- Ban reason capped at 255 chars.
- Banlist visibility: only `canBan` users see it at all; only
  `effectiveRank >= 255` (superadmin) sees **unmasked** IPs — everyone
  else sees `util.cloakIP()`-obscured addresses even in the ban admin
  panel.

### Join-time enforcement (`onUserPreJoin`)
Ban checks run **before a user is allowed to join a registered
channel** at all — by name+IP if named, by IP only if anonymous. This
happens before `onUserPostJoin`, i.e. before most other module setup.

---

## 5. Library (`library.js`)

Two search paths depending on `data.source`:
- `"yt"` (explicit) or channel not registered or user lacks
  `canSeePlaylist` → searches YouTube directly via `InfoGetter`.
- Otherwise → searches the channel's own persisted media library
  (`db.channels.searchLibrary`), sorted case-insensitively by title.

Query capped at 100 chars either way. Results come back via a single
`searchResults` event tagged with `source: "yt"` or `source:
"library"` — a client needs to branch on that field to render
appropriately (YouTube results vs. previously-played channel media).

`uncache` (remove a single item from the channel's saved library)
requires `canUncache` and only works on registered channels.

Media only gets auto-cached into the library if the channel is
registered **and** the media type isn't a live stream
(`!util.isLive(media.type)`).

---

## 6. Channel Options (`opts.js`)

Full default option set (this is the authoritative list — any custom
settings-panel UI should mirror these keys exactly):

```js
{
    allow_voteskip: true,
    voteskip_ratio: 0.5,
    afk_timeout: 600,              // seconds
    pagetitle: "<channel name>",
    maxlength: 0,                  // 0 = no cap, seconds
    externalcss: "",
    externaljs: "",
    chat_antiflood: false,
    chat_antiflood_params: { burst: 4, sustained: 1, cooldown: 4 },
    show_public: false,
    enable_link_regex: true,
    password: false,
    allow_dupes: false,
    torbanned: false,
    block_anonymous_users: false,
    allow_ascii_control: false,
    playlist_max_per_user: 0,      // 0 = no cap
    new_user_chat_delay: 0,        // seconds since first-seen before allowed to chat
    new_user_chat_link_delay: 0,   // seconds since first-seen before allowed to post links
    playlist_max_duration_per_user: 0  // seconds, 0 = no cap
}
```

Setting any option requires `canSetOptions` (rank >= 2 per WS-068) —
violating this **kicks** the user
(`"Attempted setOptions as a non-moderator"`), matching the same
kick-on-violation pattern seen in `customization.js` and `ranks.js`.

Server-side clamps applied on load, regardless of what was saved:
`chat_antiflood_params.burst` clamped to max 20, `.sustained` to max
10, `afk_timeout` to max 86400 (one day). Individual `setOptions`
fields are validated per-key with `validationError`/`validationPassed`
acknowledgement events (client should listen for these to give
inline field feedback rather than assuming a save always succeeds).

---

## 7. Poll (`poll.js`)

### Creation (`newPoll`, ack-based — not fire-and-forget)
Requires `canControlPoll` (rank >= 1.5 per WS-068, i.e. requires at
least Leader status). Automatically closes any existing poll first.
Validation (`validatePollInput`) throws `ValidationError` for: non-
string title, title > 255 chars, non-array options, more than
`Config.get('poll.max-options')` options, any option that's empty or
> 255 chars. `timeout` (optional) must be 1–86400 seconds; if set, the
poll auto-closes via `setTimeout`. **Errors come back through the ack
callback**, not a separate event — a client must pass an ack function
when emitting `newPoll` to get validation feedback.

### Hidden/obscured polls — the two-room mechanism
This is the most structurally interesting part: CyTube uses **two
separate Socket.IO rooms per channel** for poll visibility —
`<channel>:viewHidden` and `<channel>:noViewHidden`. Every user is
placed into exactly one based on `canViewHiddenPoll`, and re-evaluated
on every `effectiveRankChange` (e.g. gaining/losing Leader). A hidden
poll's live vote counts are broadcast **only** to the `:viewHidden`
room; everyone else gets a version with counts obscured. This is a
cleaner mechanism than per-user filtering — any custom poll UI relying
on vote-count updates should know results may legitimately differ
between users watching the same poll.

### Voting (`vote`)
Requires `canVote` (rank -1 per WS-068 — open to everyone including
guests). Vote is tied to `user.realip`, so re-voting from the same IP
just updates the existing vote (`countVote` returns falsy on a no-op
re-vote, which skips a needless rebroadcast).

### Chat-command polls
`poll <title>,<opt1>,<opt2>,...` and `hpoll <...>` (hidden variant) are
registered as chat commands too — comma-delimited, same validation
path as the socket version, but errors go through `errorMsg` instead
of an ack.

---

## 8. Voteskip (`voteskip.js`)

Built on the same generic `Poll` class as the Poll module, internally
created as `Poll.create("[server]", "voteskip", ["skip"])` — i.e. a
voteskip *is* a single-option poll under the hood.

### Eligibility math
```
eligible = total_users - (no_permission_users + afk_users)
need = max(1, ceil(eligible * voteskip_ratio))
```
AFK users and users without `canVoteskip` are excluded from the
denominator entirely, not just prevented from voting — so a room full
of AFK/unpermissioned users doesn't inflate the threshold.

Vote is tied to `user.realip` (same dedup pattern as poll votes). On
pass: broadcasts a system chat message (`username: "[server]"` — note:
different sender label than `sendModMessage`'s `"[server]"` vs. the
voteskip-specific `"[voteskip]"` seen in some versions) with the
eligible/AFK/no-permission breakdown, then immediately calls
`playlist._playNext()`.

Live vote-count visibility is gated separately by
`canSeeVoteskipResults` — a user can be eligible to *vote* without
being allowed to *see the running count*, similar in spirit to the
poll module's hidden-poll room split but implemented as a simple
per-emit permission check instead of two rooms.

---

## 9. Drink counter (`drink.js`)

Marked in its own source comment as a legacy/niche module kept only
for backward compatibility. Hijacks chat via `onUserPreChat` (same
extension point available to any future custom module):
- `/d` alone → increments by 1, message becomes `"<rest of text>
  drink!"`.
- `/d5` → increments by 5, same treatment, `count` clamped to
  ±10,000.
- `/d-3` → decrements by 3.
- **Special case:** `/d5` with **no additional text** and a **positive**
  count → the chat message is fully suppressed
  (`cb(null, ChannelModule.DENY)`) and *only* the counter updates
  silently via `drinkCount` broadcast — no chat line appears at all.
  Any other combination (text present, or a negative/zero count) still
  produces a visible chat message styled with `meta.addClass = "drink"`
  and `meta.forceShowName = true`.

Gated by `canCallDrink` (rank 1.5 per WS-068 — same tier as `/say`).
Counter resets to 0 automatically on every `onMediaChange` (new video
starts).

---

## Cross-cutting patterns worth remembering for future custom scripts

1. **Kick-on-violation is the norm for admin-tier actions**, not a
   silent no-op: `setChannelCSS`/`setChannelJS`/`setMotd`/
   `setPermissions`/`setOptions`/`assignLeader` all kick a user who
   attempts them without permission. Client-side hiding of a button is
   cosmetic; the server enforcement is real and unforgiving.
2. **The "can't target equal-or-higher rank" rule** is implemented
   independently in kick, ban, mute, and smute — worth treating as a
   general invariant when reasoning about what any given rank *can't*
   do to another user, even in modules not explicitly covered here.
3. **Ack-based vs. event-based error reporting** varies by module:
   `newPoll` uses an ack callback; most everything else
   (`setOptions`, filters, emotes) uses a separate `errorMsg`/
   `validationError` event. A generic "did my action succeed" wrapper
   for a custom script needs to handle both patterns.
4. **Two distinct visibility-splitting mechanisms exist** for the same
   general problem (some users should see more than others): Socket.IO
   rooms (poll hidden-votes) vs. per-emit permission filtering
   (voteskip results, banlist IP masking, filter/emote broadcasts to
   `canEditFilters`-only users). Neither is universal — check which
   pattern a given feature uses before assuming real-time updates reach
   everyone.
