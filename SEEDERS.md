# Seeders

**Authorship:** William von Meister (Project Owner) + GPT-5.6 Luna / `LUNA-HS-001` (AI Collaborator)

**Authorship rule:** This document was created collaboratively in this project. Human decisions, direction, and requirements are attributed to William von Meister; AI-authored drafting and analysis are attributed to the named AI collaborator and its unique project author ID. Author ID identifies provenance, not technical authority.

## Purpose

A durable seeder is a node whose explicit purpose is to retain and serve verified replicas with substantially greater availability than an ordinary browser peer.

## Seeder contract

A durable seeder should make explicit:

- what media/representations it retains,
- what storage it commits,
- whether it accepts uploads,
- its availability expectations,
- its current health/capacity,
- how it handles eviction and integrity failures.

The exact protocol is intentionally deferred.

## Trust

Seeder status does not make bytes trustworthy by itself. Every retained segment remains subject to the same identity and integrity rules as browser-held replicas.

A seeder may provide higher availability, not higher semantic authority.

## Failure model

Seeders can fail, disconnect, become unavailable, lose storage, or serve stale metadata. The system therefore remains useful with multiple sources and HTTP fallback.

## Seeder discovery

Discovery should communicate participation and availability without requiring a universal global catalog of all media held by all users.

A future durable seeder may be discovered through application-specific control mechanisms, trackers, or other explicit service discovery.

## Scaling role

Durable seeders are an architectural extension of the same replica model, not a second media system. The same Media, Representation, Segment, and Replica concepts should apply to browsers and seeders.

> **Design rule:** A durable seeder is a more persistent replica provider, not a new source of truth for media identity.
