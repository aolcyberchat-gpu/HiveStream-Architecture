Human Project Lead: William / AI: Claude Sonnet 5 (Anthropic)
Status: WORKING / SCRATCH LAYER

# cytu.be Live Deployment vs. calzoneman/sync (3.0 branch) — Diff Analysis

Termux-executed, self-verifying comparison of five client JS files served live by
https://cytu.be/js/ against the same files at the tip of the public `3.0` branch
(https://raw.githubusercontent.com/calzoneman/sync/3.0/www/js/), run 2026-09-10.

## Method
CyTube exposes no version number via HTTP headers, page content, or any endpoint
(confirmed: no version string in src/web/routes/*, no X-Powered-By CyTube header,
no /version or /about JSON route). The only reliable way to characterize the live
deployment is a direct byte-level diff of the served, unminified client files
against a known git ref, since CyTube serves www/js/*.js as plain unbundled files.

Command used (Termux):
```
mkdir -p ~/cytube-version-check && cd ~/cytube-version-check
for f in callbacks.js util.js ui.js data.js player.js; do
  curl -s "https://cytu.be/js/$f" -o "live-$f"
  curl -s "https://raw.githubusercontent.com/calzoneman/sync/3.0/www/js/$f" -o "head-$f"
done
diff head-callbacks.js live-callbacks.js
diff head-util.js live-util.js
diff head-ui.js live-ui.js
diff head-data.js live-data.js
```

## Result summary

| File | Live lines | Repo (3.0 tip) lines | Diff lines | Verdict |
|---|---|---|---|---|
| callbacks.js | 1354 | 1354 | 19 | Patched |
| util.js | 3500 | 3476 | 33 | Patched |
| ui.js | 979 | 944 | 38 | Patched |
| data.js | 309 | 300 | 10 | Patched |
| player.js | 1996 | 0 (not in repo) | N/A | Invalid comparison — see note |

**Note on player.js:** `www/js/player.js` is NOT committed to the repo. Per
`bin/build-player.js`, it is a build artifact concatenated + CoffeeScript-compiled
from individual `.coffee` files under `/player/` at deploy time (gitignored). The
"0 lines / DIFFERS" result for this file is a false signal from the comparison
methodology, not a real discrepancy. Ignore it in any future re-run of this test.

## What the real diffs actually are

None of the four genuine diffs are generic CyTube features running ahead of the
public branch. They break into two categories:

### A. Site-specific operator patches (specific to calzoneman's cytu.be, not portable)
1. **Unregistered-channel-disabled message** (callbacks.js ~line 177): public repo
   shows a clean Bootstrap alert div; live replaces it with a raw `document.write()`
   containing a personal message about banning channels for ToS violations/ban evasion.
2. **Imgur hotlink blocking** (util.js, ui.js, data.js): a full validation layer
   blocking emote images and chat-filter replacement text that references imgur.com,
   with an explicit `IMGUR_EMOTE_MSG` citing Imgur's ToS on hotlinking/CDN use.
   Corresponds to Imgur banning cytu.be from hotlinking at some point.
3. **Hardcoded domain block** (ui.js): links matching `hazbinhelluvageneral.com` are
   rejected client-side citing a DMCA notice specific to that domain.
4. **Channel-specific troll response** (ui.js): hardcoded check for a channel named
   exactly `guest_army` blocking "spoon" emotes with a sarcastic message — a specific
   moderation incident, not generalizable.

### B. Small genuine bugfixes not yet in the public branch
- util.js: null-guard added before accessing `PLAYER.mediaType`/`PLAYER.mediaId`.
- util.js: regex for `<strong>label:</strong>`-style message detection loosened to
  also match `<strong>label</strong>:` ordering.
- callbacks.js: an `onEmptyPlaylist()` callback hook exists live but not in the
  public branch.
- callbacks.js: public branch actually contains EXTRA dead code live doesn't have
  (a Let's Encrypt HTTPS-upgrade-detection block) — cleaned up in production,
  not yet removed from the repo.
- util.js: a commented-out (inert) message about YouTube revoking CyTube's API
  access, dated June 27, 2023 — historical/dead code, not active.

## Conclusion

**There is no clean "version number" for cytu.be.** It runs the `3.0` branch
(package.json reports v3.86.1 as of the Nov 2025 tarball pull) plus an undisclosed,
operator-specific patch layer that is never pushed to the public repo. This is
expected/normal for a maintainer's own reference deployment — moderation patches,
DMCA responses, and site-specific bugfixes for a public server would not belong
in the general-purpose open-source codebase.

**Important for the knowledge base:** none of the diffed lines touch playlist sync,
leader/autolead logic, permissions, or chat flood/rate-limiting — the exact areas
most reverse-engineered in this project (WS-042 through WS-073). This is a
meaningful negative result: it supports treating the server-side source pulled
from the `3.0` branch (see prior document:
2026-09-10-19-29_cytube-upstream-source-deep-dive.md) as functionally accurate
for cytu.be's actual sync/leader/permission/flood behavior, even though the
client bundle carries operator-specific patches on top.

## Recommended follow-up
- If a future resync needs a "version fingerprint" for cytu.be specifically
  (e.g., to detect when operator patches change), save this diff output as a
  baseline and re-run the same Termux command periodically — new diffs relative
  to this baseline would indicate either a public-branch update pulled in, or a
  new operator patch.
- The player.js build-artifact issue means a true player.js comparison would
  require running `bin/build-player.js` locally against the `/player/*.coffee`
  sources at the matching commit, then diffing that output against live —
  not yet done.

*End of document.*
