import assert from "node:assert/strict";
import { test } from "node:test";

import {
  deriveExternalSegmentId,
  deriveStreamSwarmId,
  deriveSwarmId,
  deriveSwarmIdentity,
} from "../../src/identity/derive.js";
import { asMediaId, asRepresentationId, asSegmentId } from "../../src/identity/types.js";

test("deriveSwarmId is deterministic for the same MediaId", async () => {
  const mediaId = asMediaId("media-abc");
  const a = await deriveSwarmId(mediaId);
  const b = await deriveSwarmId(mediaId);
  assert.equal(a, b);
});

test("deriveSwarmId differs for different MediaIds", async () => {
  const a = await deriveSwarmId(asMediaId("media-abc"));
  const b = await deriveSwarmId(asMediaId("media-xyz"));
  assert.notEqual(a, b);
});

test("deriveStreamSwarmId is deterministic and representation-specific", async () => {
  const rep1080p = asRepresentationId("rep-1080p");
  const rep720p = asRepresentationId("rep-720p");

  const a1 = await deriveStreamSwarmId(rep1080p);
  const a2 = await deriveStreamSwarmId(rep1080p);
  const b = await deriveStreamSwarmId(rep720p);

  assert.equal(a1, a2);
  assert.notEqual(a1, b);
});

test("two peers that already agree on MediaId/RepresentationId converge on one SwarmIdentity", async () => {
  // How two peers independently arrive at the *same* MediaId in the first
  // place is HS-001 and is still open (see derive.ts doc comment). This
  // test only proves the piece this module actually implements: once two
  // peers agree on a MediaId + RepresentationId, swarm identity derivation
  // is deterministic, which is the mechanism that makes rewatch bandwidth
  // savings possible at all.
  const mediaId = asMediaId("same-episode");
  const representationId = asRepresentationId("same-episode-720p");

  const peerA = await deriveSwarmIdentity(mediaId, representationId);
  const peerB = await deriveSwarmIdentity(mediaId, representationId);

  assert.deepEqual(peerA, peerB);
});

test("deriveExternalSegmentId is deterministic per SegmentId", async () => {
  const segmentId = asSegmentId("seg-000042");
  const a = await deriveExternalSegmentId(segmentId);
  const b = await deriveExternalSegmentId(segmentId);
  assert.equal(a, b);
});
