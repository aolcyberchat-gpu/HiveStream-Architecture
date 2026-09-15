# CyTube Adapter

**Authorship:** William von Meister (Project Owner) + GPT-5.6 Luna / `LUNA-HS-001` (AI Collaborator)

**Authorship rule:** This document was created collaboratively in this project. Human decisions, direction, and requirements are attributed to William von Meister; AI-authored drafting and analysis are attributed to the named AI collaborator and its unique project author ID. Author ID identifies provenance, not technical authority.

## Purpose

The CyTube adapter connects CyTube's application state and playback environment to HiveStream Core without making CyTube internals part of the core architecture.

## Responsibilities

The adapter may translate:

- current channel/media state,
- playlist changes,
- channel membership,
- CyTube permissions and leadership,
- playback commands,
- application synchronization state,
- media URLs and representation information.

## Boundary

```text
CyTube callbacks / socket / DOM
              ↓
        CyTube Adapter
              ↓
        HiveStream Core
```

CyTube-specific globals, callbacks, DOM IDs, and socket events remain adapter implementation details.

## Media identity

The adapter may provide source information used to construct or resolve HiveStream Media and Representation identities. It must not equate a CyTube URL, playlist item ID, or socket event with universal media identity without an explicit identity rule.

## Playback

CyTube playback state can drive higher-level synchronization. That synchronization must not silently become the authority for segment integrity or replica state.

## Permissions

CyTube permissions may determine which application actions are allowed, such as who can change playlist or playback state. These permissions should be translated into adapter-level authority rather than embedded into HiveStream's media semantics.

## Failure isolation

If CyTube disconnects, HiveStream should be able to preserve valid local replica state. Conversely, HiveStream distribution failure should not corrupt CyTube playlist/application state.

## Reverse-engineering dependency

The adapter can evolve as CyTube behavior changes. Reverse-engineered CyTube knowledge belongs in the separate evidence repository; this document defines the architectural boundary, not a frozen CyTube implementation.

> **Design rule:** CyTube is the first application of HiveStream, not the definition of HiveStream.
