# Security

**Authorship:** William von Meister (Project Owner) + GPT-5.6 Luna / `LUNA-HS-001` (AI Collaborator)

**Authorship rule:** This document was created collaboratively in this project. Human decisions, direction, and requirements are attributed to William von Meister; AI-authored drafting and analysis are attributed to the named AI collaborator and its unique project author ID. Author ID identifies provenance, not technical authority.

## Security goals

HiveStream should preserve:

1. segment integrity;
2. clear trust boundaries between control and media data;
3. explicit sharing intent;
4. isolation between peers and applications;
5. resilience against stale or malicious availability metadata.

## Threat classes

The architecture should account for at least:

- corrupted segments,
- malicious segment substitution,
- forged or stale availability claims,
- abusive upload requests,
- peer impersonation where transport identity permits it,
- resource exhaustion,
- storage exhaustion,
- malicious local application messages,
- compromised or buggy adapters.

## Integrity

Cryptographic or equivalent content-integrity verification is the principal defense against accepting incorrect media bytes as a trusted replica.

Transport security does not replace content verification.

## Availability is not trust

A peer claiming to possess a segment is not proof that the segment is correct. A successful WebRTC connection is not proof of media transfer. A durable seeder is not automatically authoritative.

## Resource limits

Implementations should enforce limits on:

- concurrent peer connections,
- outstanding segment requests,
- upload bandwidth,
- storage usage,
- memory buffering,
- ingestion work,
- control-message size/rate.

Exact values should be implementation and deployment policy, not architecture constants.

## Privacy

The system should minimize unnecessary disclosure of what a user possesses. The no-global-catalog principle is partly a privacy boundary: peer availability should be scoped rather than exposing a universal inventory of local media.

## Application boundary

CyTube permissions and authentication do not automatically secure arbitrary HiveStream peer traffic. The adapter must translate application authority carefully while keeping media integrity independent.

> **Design rule:** Security comes from explicit trust boundaries and verified content, not from assuming that connected peers or application metadata are trustworthy.
