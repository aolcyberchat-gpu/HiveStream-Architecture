# Control Plane

**Authorship:** William von Meister (Project Owner) + GPT-5.6 Luna / `LUNA-HS-001` (AI Collaborator)

**Authorship rule:** This document was created collaboratively in this project. Human decisions, direction, and requirements are attributed to William von Meister; AI-authored drafting and analysis are attributed to the named AI collaborator and its unique project author ID. Author ID identifies provenance, not technical authority.

## Purpose

The control plane coordinates application and distribution metadata. It does not carry the normal media-byte payload.

## Responsibilities

The control plane may coordinate:

- application/channel membership,
- Media and Representation identity,
- playlist/application state,
- swarm participation,
- peer discovery,
- replica availability hints,
- replication policy signals,
- local-ingestion declarations,
- node capabilities.

## No global catalog

Control-plane state should not become a universal index of everything every user possesses. Availability should be scoped to the relevant media, representation, swarm, application, or discovery context.

## Hints versus authority

Peer availability is advisory. A control message saying that a peer has segment X does not itself create trusted replica state. The receiving node must obtain and verify the bytes.

Similarly, control-plane membership does not grant permission to redefine Media identity.

## Versioning

Mutable control state should carry enough ordering information to resolve delayed, duplicated, or conflicting messages. Depending on the state, this may be an epoch, revision, sequence number, timestamp, or another explicit mechanism.

## Security boundary

Control-plane messages must be treated as untrusted network input. Authentication and authorization requirements depend on the application integration, but media integrity cannot depend solely on control-plane claims.

## CyTube relationship

The CyTube adapter may translate channel membership, current media, playlist state, permissions, and synchronization information into HiveStream concepts. Those mappings belong at the adapter boundary rather than inside the semantic media core.

> **Design rule:** The control plane coordinates who, what, and where; it does not become the trusted store of media bytes.
