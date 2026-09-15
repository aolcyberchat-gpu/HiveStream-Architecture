/**
 * In-memory identity registry: the relationship graph
 * Media -> Representations -> Segments, plus the ExternalSegmentId ->
 * SegmentIdentity reverse lookup that cytube-knowledge
 * HIVESTREAM-P2P-MEDIA-LOADER-REUSE-FINDINGS.md §14 identifies as
 * necessary ("the stream registry still needs to be able to map [the P2P
 * protocol's] external ID back to a registered Segment").
 *
 * Deliberately NOT a catalog. There is no listAllMedia() / search-by-title
 * method, and none should be added here — DEC-001 §14, "keep the
 * no-global-index principle": the network should discover availability for
 * a specific, already-known media reference, not expose a browsable index
 * of everything any peer holds. "What media exists" is room/playlist
 * state, not identity-registry state. See the "no catalog-wide listing
 * method" test in tests/identity/registry.test.ts, which exists to catch a
 * regression of this constraint, not just to document it.
 *
 * IndexedDB-backed persistence (DECISIONS.md D-006) is a separate later
 * concern. This in-memory registry is the identity/lookup logic to be
 * exercised in Phase 1 before wiring persistence.
 */

import { deriveExternalSegmentId } from "./derive.js";
import type {
  ExternalSegmentId,
  MediaId,
  MediaIdentity,
  RepresentationId,
  RepresentationIdentity,
  SegmentId,
  SegmentIdentity,
} from "./types.js";

export class IdentityRegistry {
  readonly #media = new Map<MediaId, MediaIdentity>();
  readonly #representationsByMedia = new Map<MediaId, Set<RepresentationId>>();
  readonly #representations = new Map<RepresentationId, RepresentationIdentity>();
  readonly #segmentsByRepresentation = new Map<RepresentationId, Set<SegmentId>>();
  readonly #segments = new Map<SegmentId, SegmentIdentity>();
  readonly #externalIdToSegment = new Map<ExternalSegmentId, SegmentId>();
  readonly #segmentToExternalId = new Map<SegmentId, ExternalSegmentId>();

  registerMedia(media: MediaIdentity): void {
    this.#media.set(media.mediaId, media);
    if (!this.#representationsByMedia.has(media.mediaId)) {
      this.#representationsByMedia.set(media.mediaId, new Set());
    }
  }

  registerRepresentation(representation: RepresentationIdentity): void {
    if (!this.#media.has(representation.mediaId)) {
      throw new Error(
        `Cannot register representation ${representation.representationId}: ` +
          `unknown mediaId ${representation.mediaId}. Register the MediaIdentity first.`,
      );
    }
    this.#representations.set(representation.representationId, representation);
    this.#representationsByMedia.get(representation.mediaId)!.add(representation.representationId);
    if (!this.#segmentsByRepresentation.has(representation.representationId)) {
      this.#segmentsByRepresentation.set(representation.representationId, new Set());
    }
  }

  /**
   * Registers a segment and computes+records its transport-facing
   * externalId. Returns the externalId so the caller can hand it to
   * p2p-media-loader's Segment registration.
   */
  async registerSegment(segment: SegmentIdentity): Promise<ExternalSegmentId> {
    if (!this.#representations.has(segment.representationId)) {
      throw new Error(
        `Cannot register segment ${segment.segmentId}: unknown representationId ` +
          `${segment.representationId}. Register the RepresentationIdentity first.`,
      );
    }
    this.#segments.set(segment.segmentId, segment);
    this.#segmentsByRepresentation.get(segment.representationId)!.add(segment.segmentId);

    const externalId = await deriveExternalSegmentId(segment.segmentId);
    this.#externalIdToSegment.set(externalId, segment.segmentId);
    this.#segmentToExternalId.set(segment.segmentId, externalId);
    return externalId;
  }

  getMedia(mediaId: MediaId): MediaIdentity | undefined {
    return this.#media.get(mediaId);
  }

  getRepresentation(representationId: RepresentationId): RepresentationIdentity | undefined {
    return this.#representations.get(representationId);
  }

  getSegment(segmentId: SegmentId): SegmentIdentity | undefined {
    return this.#segments.get(segmentId);
  }

  listRepresentations(mediaId: MediaId): readonly RepresentationIdentity[] {
    const ids = this.#representationsByMedia.get(mediaId);
    if (!ids) return [];
    return [...ids].map((id) => this.#representations.get(id)!);
  }

  listSegments(representationId: RepresentationId): readonly SegmentIdentity[] {
    const ids = this.#segmentsByRepresentation.get(representationId);
    if (!ids) return [];
    return [...ids].map((id) => this.#segments.get(id)!);
  }

  /** The reverse lookup findings §14 identifies as required. */
  resolveExternalSegmentId(externalId: ExternalSegmentId): SegmentIdentity | undefined {
    const segmentId = this.#externalIdToSegment.get(externalId);
    return segmentId === undefined ? undefined : this.#segments.get(segmentId);
  }

  getExternalSegmentId(segmentId: SegmentId): ExternalSegmentId | undefined {
    return this.#segmentToExternalId.get(segmentId);
  }
}
