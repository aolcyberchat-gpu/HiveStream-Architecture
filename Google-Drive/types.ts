/**
 * HiveStream application-level identity model.
 *
 * Implements DECISIONS.md D-004 ("HiveStream owns application-level media
 * identity") and the four-layer split from
 * docs/DEC-001-GPT-Independent-Ground-Up-Architecture.md §3:
 *
 *   Media Identity -> Representation Identity -> Segment Identity
 *                                                       |
 *                                              (never becomes)
 *                                                       v
 *                                              Swarm Identity
 *
 * Evidence status for this whole module: DESIGN PROPOSAL (LLM-HANDOFF.md
 * evidence-discipline scale). Nothing here has been exercised against a
 * real p2p-media-loader Core instance yet — that is Phase 1B/HS-004 work.
 * See derive.ts and registry.ts for what specifically remains open.
 */

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

// --- HiveStream-owned canonical identities -------------------------------
// These never depend on CyTube, room, URL, tracker, peer, session, or the
// current swarm (DEC-001 §3.1). Only this module and code that has already
// resolved an id may construct one directly (asMediaId/asRepresentationId/
// asSegmentId below) — everything downstream should receive these, not
// invent them.

export type MediaId = Brand<string, "MediaId">;
export type RepresentationId = Brand<string, "RepresentationId">;
export type SegmentId = Brand<string, "SegmentId">;

// --- Transport-facing identities ------------------------------------------
// These are the p2p-media-loader-facing values (cytube-knowledge
// HIVESTREAM-P2P-MEDIA-LOADER-REUSE-FINDINGS.md §4/§7/§14: `swarmId`,
// `streamSwarmId`, and segment `externalId` are the exact fields the
// transport reads). They are intentionally a DISTINCT branded type from
// the canonical ids above, and this module deliberately provides no
// `asSwarmId`/`asStreamSwarmId`/`asExternalSegmentId` constructor: the only
// way to get one is derive.ts's deterministic derivation from a canonical
// id. That is the concrete enforcement of DEC-001 §3.4 — "swarm identity
// must not silently become canonical content identity" — as a compile-time
// property rather than a convention someone has to remember.

export type SwarmId = Brand<string, "SwarmId">;
export type StreamSwarmId = Brand<string, "StreamSwarmId">;
export type ExternalSegmentId = Brand<string, "ExternalSegmentId">;

export function asMediaId(value: string): MediaId {
  return value as MediaId;
}
export function asRepresentationId(value: string): RepresentationId {
  return value as RepresentationId;
}
export function asSegmentId(value: string): SegmentId {
  return value as SegmentId;
}

/**
 * How a MediaIdentity's id was established. Kept alongside the id so a
 * provisional identity (e.g. assigned when a URL is first seen) can later
 * be reconciled to a stronger one (e.g. once a content hash is available)
 * without changing what callers hold.
 *
 * Resolving two independently-obtained copies of equivalent media onto the
 * same MediaId at all is HS-001 (DEC-001 §20) and is UNPROVEN / OPEN — this
 * type only records which basis was used, it does not implement
 * reconciliation.
 */
export type MediaIdentityBasis =
  | { readonly kind: "content-hash"; readonly algorithm: "sha-256"; readonly hash: string }
  | { readonly kind: "source-url"; readonly url: string }
  | { readonly kind: "local-ingestion"; readonly fileHash: string };

/**
 * Media Identity — "what media is this?" (DEC-001 §3.1)
 */
export interface MediaIdentity {
  readonly mediaId: MediaId;
  readonly basis: MediaIdentityBasis;
  readonly title?: string;
}

/**
 * Representation Identity — "which encoded representation is this?"
 * (DEC-001 §3.2). Belongs to exactly one MediaIdentity.
 */
export interface RepresentationIdentity {
  readonly representationId: RepresentationId;
  readonly mediaId: MediaId;
  /** e.g. "avc1.640028,mp4a.40.2" */
  readonly codec: string;
  readonly resolution?: { readonly width: number; readonly height: number };
  readonly bitrateBps?: number;
}

/**
 * Segment Identity — "which exact media unit are we talking about?"
 * (DEC-001 §3.3). Belongs to exactly one RepresentationIdentity. The
 * segment is the unit of verification, transfer, storage and replication
 * (hivestream-my-design.md).
 */
export interface SegmentIdentity {
  readonly segmentId: SegmentId;
  readonly representationId: RepresentationId;
  /** Position within the representation. */
  readonly sequence: number;
  readonly byteLength: number;
  readonly hash: { readonly algorithm: "sha-256"; readonly value: string };
  readonly startTimeSeconds?: number;
  readonly endTimeSeconds?: number;
}

/**
 * Swarm Identity — "which peers are currently exchanging this material?"
 * (DEC-001 §3.4). A transport/distribution concept, not canonical content
 * identity. This type should only ever appear as the *output* of
 * derive.ts's deriveSwarmIdentity() — nothing in this module accepts a
 * SwarmIdentity as input to identify media, a representation, or a segment.
 */
export interface SwarmIdentity {
  /** p2p-media-loader Stream.swarmId — shared by all representations of one MediaIdentity. */
  readonly swarmId: SwarmId;
  /** p2p-media-loader Stream.streamSwarmId — specific to one RepresentationIdentity. */
  readonly streamSwarmId: StreamSwarmId;
}
