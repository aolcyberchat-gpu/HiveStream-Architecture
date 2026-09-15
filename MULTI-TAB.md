# Multi-Tab

**Authorship:** William von Meister (Project Owner) + GPT-5.6 Luna / `LUNA-HS-001` (AI Collaborator)

**Authorship rule:** This document was created collaboratively in this project. Human decisions, direction, and requirements are attributed to William von Meister; AI-authored drafting and analysis are attributed to the named AI collaborator and its unique project author ID. Author ID identifies provenance, not technical authority.

## Requirement

Multiple tabs in one browser profile should not accidentally behave as unrelated HiveStream peers.

The semantic requirement is stronger than any particular implementation mechanism:

```text
One browser profile
       ↓
Coherent local HiveStream node
       ↓
Shared replica / peer semantics
```

## Why it matters

Without coordination, five tabs could appear to be five independent peers, duplicate downloads, duplicate uploads, compete for storage, and distort swarm availability.

## Candidate mechanisms

A SharedWorker is a plausible browser mechanism. Other mechanisms may be appropriate depending on browser support and implementation constraints.

The architecture does not require SharedWorker specifically.

## Ownership

One browser-local coordinator should be responsible for node-level decisions such as peer participation, shared replica access, and resource scheduling. Individual tabs remain application clients.

## Playback

Different tabs may intentionally display different playback states. Therefore multi-tab coordination must not force all tabs to have identical playback state merely because they share one HiveStream node.

The distinction is:

- node-level media possession and peer semantics are shared;
- tab-level application/playback state may differ unless the application explicitly synchronizes it.

## Failure

If the coordinating context disappears, another tab should be able to assume responsibility without creating a second permanent node identity or corrupting replica state.

## Security

Messages between tabs are untrusted input and should be validated. A tab should not be able to bypass replica integrity rules by communicating directly with storage or peer transport in a way that violates the node model.

> **Design rule:** Multiple tabs may be multiple views, but they should not accidentally become multiple independent replicas and peers.
