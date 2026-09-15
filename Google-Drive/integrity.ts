/**
 * Segment integrity verification.
 *
 * hivestream-my-design.md: "a from-day-one integrity/hash-check
 * requirement on every received segment, since the entire premise is
 * trusting unreliable peers for correct bytes." This is meant to sit on
 * the acquisition path for BOTH HTTP and P2P — D-005 treats P2P as an
 * optimization, not a more-trusted path than HTTP, so neither should skip
 * the check.
 *
 * Evidence status: the hashing itself is ordinary SubtleCrypto usage
 * (SOURCE PROVEN). Where this function should be called from in the real
 * acquisition path is a Phase 1B/HS-004 integration question, not decided
 * here.
 */

import type { SegmentIdentity } from "./types.js";

export class SegmentIntegrityError extends Error {
  constructor(
    readonly segmentId: string,
    readonly expectedHash: string,
    readonly actualHash: string,
  ) {
    super(
      `Segment integrity check failed for ${segmentId}: expected ${expectedHash}, got ${actualHash}`,
    );
    this.name = "SegmentIntegrityError";
  }
}

async function sha256Hex(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  // Both ArrayBuffer and Uint8Array are valid SubtleCrypto inputs at
  // runtime; the `as BufferSource` cast works around lib.dom.d.ts's
  // ArrayBufferLike-vs-ArrayBuffer generic strictness on typed arrays.
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Computes the content hash of received segment bytes. */
export async function computeSegmentHash(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  return sha256Hex(bytes);
}

/**
 * Verifies bytes received from a peer or HTTP against the declared
 * SegmentIdentity before they are handed to storage or playback.
 *
 * Throws SegmentIntegrityError (rather than returning a boolean) so a
 * caller cannot accidentally ignore a failed check.
 */
export async function verifySegmentIntegrity(
  segment: Pick<SegmentIdentity, "segmentId" | "hash">,
  bytes: ArrayBuffer | Uint8Array,
): Promise<void> {
  if (segment.hash.algorithm !== "sha-256") {
    throw new Error(`Unsupported hash algorithm: ${segment.hash.algorithm}`);
  }
  const actual = await computeSegmentHash(bytes);
  if (actual !== segment.hash.value) {
    throw new SegmentIntegrityError(segment.segmentId, segment.hash.value, actual);
  }
}
