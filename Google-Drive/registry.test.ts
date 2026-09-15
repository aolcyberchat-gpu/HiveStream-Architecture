import assert from "node:assert/strict";
import { test } from "node:test";

import { IdentityRegistry } from "../../src/identity/registry.js";
import { asMediaId, asRepresentationId, asSegmentId } from "../../src/identity/types.js";
import type { MediaIdentity, RepresentationIdentity, SegmentIdentity } from "../../src/identity/types.js";

function makeMedia(): MediaIdentity {
  return {
    mediaId: asMediaId("media-1"),
    basis: { kind: "source-url", url: "https://example.invalid/video.m3u8" },
  };
}

test("registerRepresentation rejects an unknown mediaId", () => {
  const registry = new IdentityRegistry();
  assert.throws(() =>
    registry.registerRepresentation({
      representationId: asRepresentationId("rep-1"),
      mediaId: asMediaId("nonexistent"),
      codec: "avc1.640028",
    }),
  );
});

test("registerSegment rejects an unknown representationId", async () => {
  const registry = new IdentityRegistry();
  await assert.rejects(() =>
    registry.registerSegment({
      segmentId: asSegmentId("seg-1"),
      representationId: asRepresentationId("nonexistent"),
      sequence: 0,
      byteLength: 100,
      hash: { algorithm: "sha-256", value: "x".repeat(64) },
    }),
  );
});

test("full media -> representation -> segment registration and lookup", async () => {
  const registry = new IdentityRegistry();
  const media = makeMedia();
  registry.registerMedia(media);

  const representation: RepresentationIdentity = {
    representationId: asRepresentationId("rep-720p"),
    mediaId: media.mediaId,
    codec: "avc1.640028,mp4a.40.2",
    resolution: { width: 1280, height: 720 },
  };
  registry.registerRepresentation(representation);

  const segment: SegmentIdentity = {
    segmentId: asSegmentId("seg-0001"),
    representationId: representation.representationId,
    sequence: 1,
    byteLength: 500_000,
    hash: { algorithm: "sha-256", value: "a".repeat(64) },
  };
  const externalId = await registry.registerSegment(segment);

  assert.deepEqual(registry.listRepresentations(media.mediaId), [representation]);
  assert.deepEqual(registry.listSegments(representation.representationId), [segment]);
  assert.deepEqual(registry.resolveExternalSegmentId(externalId), segment);
  assert.equal(registry.getExternalSegmentId(segment.segmentId), externalId);
});

test("IdentityRegistry has no catalog-wide listing method (no-global-index principle)", () => {
  // Regression guard for DEC-001 §14 / ARCHITECTURE.md's no-global-index
  // constraint: this registry must only ever answer questions about
  // already-known ids, never "what media exists."
  const registry = new IdentityRegistry() as unknown as Record<string, unknown>;
  for (const forbidden of ["listAllMedia", "search", "listAll", "getAllMedia", "catalog"]) {
    assert.equal(typeof registry[forbidden], "undefined", `${forbidden} should not exist`);
  }
});
