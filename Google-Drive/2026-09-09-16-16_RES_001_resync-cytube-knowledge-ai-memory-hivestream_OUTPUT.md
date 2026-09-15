# RES-001 — Resync: duckwerks/cytube-knowledge, duckwerks/ai-memory, duckwerks/HiveStream

**Authors:** Ed (project owner) & Claude (Anthropic — cloned and read all three repos directly)

**Date:** 2026-09-09

## `duckwerks/cytube-knowledge`

Up to date with the last resync pass (WS-077 was written to Drive, not yet pushed to GitHub, so it isn't visible in the repo yet — no change on GitHub's side since the last check).

## `duckwerks/ai-memory` — exists, but currently empty

This repo contains exactly two files, `memory.md` and `memory.json`, and **both are completely empty** (just a "Create memory.md" scaffold commit). Flagging this clearly because it's directly relevant to the cross-LLM shared-memory question from earlier in this project: **this looks like it could be an attempt at exactly that** — a repo any GitHub-connected LLM (ChatGPT) and any GitHub-reading LLM (Claude, via clone) could both work from. But nothing has been written to it yet, and no schema/format has been defined. If this is meant to become the shared memory bus, it needs someone (you, or an LLM with GitHub write access) to decide a structure and start populating it — I can draft a proposed schema if useful, but I don't want to assume intent and start writing to a repo whose purpose hasn't been confirmed.

## `duckwerks/HiveStream` — the real, current, fully fleshed-out product repo

This confirms and supersedes what was flagged as an open question in the last resync report. `duckwerks/HiveStream` is a mature, well-organized project repo (`README.md`, `PROJECT-STATE.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `DECISIONS.md`, `OPEN-QUESTIONS.md`, `LLM-HANDOFF.md`, plus `src/`, `tests/`, `experiments/`, `docs/`, `archive/` scaffolding), authored with **GPT-5.6 Luna (OpenAI)** as the credited AI collaborator and Elwood Edwards as human project lead. Key facts, now source-confirmed rather than inferred from the loose `HIVESTREAM-*.md` docs seen previously:

- **This is the canonical repo going forward.** The WebTorrent-based `P2P-Theater-Core` framing in Claude's older memory is superseded. HiveStream is a from-scratch product repo, deliberately separated from research (`cytube-knowledge` stays research-only per decision D-002).
- **Stack:** Novage `p2p-media-loader` for the P2P engine, HLS.js/Video.js for playback, WebRTC DataChannels for transport, IndexedDB for persistence (OPFS deferred), HTTP as bootstrap/fallback.
- **Explicit priority order:** P2P media distribution → persistent reuse → local ingestion → swarm discovery → playlist/media identity → seeding → server bandwidth reduction → **playback synchronization is priority #8 of 9**, and CyTube leader-behavior compatibility is dead last (#9). This is a deliberate, stated inversion of what a CyTube script author might assume — HiveStream is not primarily trying to sync playback across a room; it's trying to build a persistent P2P media cache, with CyTube integration as the final, lowest-priority phase (Phase 6 of 6).
- **Current status:** Phase 1 ("P2P proof") is implemented as a standalone experiment (`experiments/phase-1-p2p-proof.html`, procedure documented in `docs/PHASE-1-P2P-PROOF.md`) — not yet exited. Exit condition is a reproducible two-browser run showing actual segment bytes crossing the WebRTC path (peer connection alone isn't accepted as proof). Explicit guardrail: **do not modify CyTube, and do not build local ingestion, replication, or WebTorrent interoperability until Phase 1 is proven.**
- **Evidence discipline** is formalized with five tiers (SOURCE PROVEN / RUNTIME PROVEN / STRONG INFERENCE / UNPROVEN·OPEN / DESIGN PROPOSAL) — worth adopting in `cytube-knowledge` findings docs too for consistency across the multi-LLM relay.
- **Decision D-010** explicitly makes local file uploads first-class ("not merely a temporary playback source... persistent, identifiable, and shareable swarm media") — this is the Phase 4 goal the PeerTube-embed investigation (WS-078, same batch) was checked against. PeerTube's embed feature was ruled out as a mechanism, but PeerTube-the-platform's own transcode/segment pipeline may be worth studying as prior art for this phase's still-open questions.

## Recommended memory/repo-map update

- Retire the "aolcyberchat-gpu/P2P-Theater-Core is canonical" framing — replace with duckwerks/HiveStream as canonical, cytube-knowledge as its dedicated research dependency (this relationship is now explicit in HiveStream's own README, not just inferred).
- Note `duckwerks/ai-memory` as an existing-but-unpopulated candidate for the cross-LLM shared memory question — awaiting a decision on schema/ownership before anything gets written there.
