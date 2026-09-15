import assert from "node:assert/strict";
import { test } from "node:test";

import {
  computeSegmentHash,
  SegmentIntegrityError,
  verifySegmentIntegrity,
} from "../../src/identity/integrity.js";
import { asSegmentId } from "../../src/identity/types.js";

function bytesFrom(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

test("computeSegmentHash is deterministic and hex-encoded sha-256", async () => {
  const bytes = bytesFrom("hello segment");
  const a = await computeSegmentHash(bytes);
  const b = await computeSegmentHash(bytes);
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test("verifySegmentIntegrity passes for matching bytes", async () => {
  const bytes = bytesFrom("correct bytes from origin");
  const hash = await computeSegmentHash(bytes);
  const segment = {
    segmentId: asSegmentId("seg-1"),
    hash: { algorithm: "sha-256" as const, value: hash },
  };
  await assert.doesNotReject(() => verifySegmentIntegrity(segment, bytes));
});

test("verifySegmentIntegrity throws SegmentIntegrityError for bytes a bad peer altered", async () => {
  const original = bytesFrom("original bytes from origin");
  const hash = await computeSegmentHash(original);
  const segment = {
    segmentId: asSegmentId("seg-2"),
    hash: { algorithm: "sha-256" as const, value: hash },
  };
  const tampered = bytesFrom("tampered bytes from a bad peer");

  await assert.rejects(
    () => verifySegmentIntegrity(segment, tampered),
    (err: unknown) => err instanceof SegmentIntegrityError,
  );
});
