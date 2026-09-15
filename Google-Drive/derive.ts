/**
 * Deterministic derivation from HiveStream's canonical identities to the
 * transport-facing values p2p-media-loader reads.
 *
 * This is HiveStream's implementation of the `streamSwarmIdBuilder`
 * customization point (cytube-knowledge
 * HIVESTREAM-P2P-MEDIA-LOADER-REUSE-FINDINGS.md §15): "HiveStream may use
 * this to make identical local media converge on the same swarm identity,
 * rather than creating a new swarm merely because the file came from a
 * different user's device."
 *
 * Evidence status: DESIGN PROPOSAL. Deterministic convergence given the
 * *same* MediaId/RepresentationId is proven below by test (two peers that
 * already agree on a MediaId will derive an identical SwarmIdentity). What
 * is NOT proven or implemented here is how two peers independently arrive
 * at the same MediaId in the first place (content-hash reconciliation
 * across independently-sourced copies) — that is HS-001, still open — and
 * this has not yet been exercised against a real p2p-media-loader Core
 * instance (HS-004, Phase 1B).
 */

import type {
  ExternalSegmentId,
  MediaId,
  RepresentationId,
  SegmentId,
  StreamSwarmId,
  SwarmId,
  SwarmIdentity,
} from "./types.js";

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Versioned prefixes so the derivation can change later (e.g. a stronger
// hash, or namespacing per-deployment) without silently colliding with ids
// computed by an older HiveStream build.
const SWARM_ID_PREFIX = "hivestream:swarm:v1:";
const STREAM_SWARM_ID_PREFIX = "hivestream:stream-swarm:v1:";
const EXTERNAL_SEGMENT_ID_PREFIX = "hivestream:external-segment:v1:";

/**
 * Derives the swarm umbrella id shared by every representation of one
 * MediaIdentity.
 */
export async function deriveSwarmId(mediaId: MediaId): Promise<SwarmId> {
  return (await sha256Hex(SWARM_ID_PREFIX + mediaId)) as SwarmId;
}

/**
 * Derives the stream-specific swarm id for one RepresentationIdentity.
 * Peers watching the same rendition converge on this id regardless of
 * which URL or local file each peer originally acquired it from.
 */
export async function deriveStreamSwarmId(
  representationId: RepresentationId,
): Promise<StreamSwarmId> {
  return (await sha256Hex(STREAM_SWARM_ID_PREFIX + representationId)) as StreamSwarmId;
}

/**
 * Derives the full transport-facing SwarmIdentity for a representation.
 * Pass this straight into p2p-media-loader's Stream registration
 * (swarmId, streamSwarmId) once Phase 1B wires up a real Core instance.
 */
export async function deriveSwarmIdentity(
  mediaId: MediaId,
  representationId: RepresentationId,
): Promise<SwarmIdentity> {
  const [swarmId, streamSwarmId] = await Promise.all([
    deriveSwarmId(mediaId),
    deriveStreamSwarmId(representationId),
  ]);
  return { swarmId, streamSwarmId };
}

/**
 * Derives the compact externalId the P2P announce/request protocol uses to
 * address a segment (findings §4/§14). IdentityRegistry.registerSegment()
 * calls this and records the externalId -> SegmentIdentity mapping needed
 * to satisfy a remote peer's request.
 */
export async function deriveExternalSegmentId(
  segmentId: SegmentId,
): Promise<ExternalSegmentId> {
  return (await sha256Hex(EXTERNAL_SEGMENT_ID_PREFIX + segmentId)) as ExternalSegmentId;
}
