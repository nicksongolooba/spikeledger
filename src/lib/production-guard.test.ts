import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  PRODUCTION_ENDPOINT_HASHES,
  isProductionDatabase,
  matchesEndpointHash,
  neonEndpointIds,
  productionRefusal,
} from "./production-guard.mjs";

// A made-up endpoint stands in for production, so the test doesn't name it.
const FAKE_PROD = "ep-quiet-river-a1b2c3d4";
const FAKE_HASHES = [createHash("sha256").update(FAKE_PROD).digest("hex")];
const DIRECT = `postgresql://owner:pw@${FAKE_PROD}.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require`;
const POOLED = `postgresql://owner:pw@${FAKE_PROD}-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require`;
const DEV = "postgresql://owner:pw@ep-bold-sun-z9y8x7w6.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require";

test("the endpoint ID comes from the host, with -pooler stripped", () => {
  assert.deepEqual(neonEndpointIds(DIRECT), [FAKE_PROD]);
  assert.deepEqual(neonEndpointIds(POOLED), [FAKE_PROD]);
});

test("direct, pooled and upper-case hosts all match production", () => {
  assert.equal(matchesEndpointHash(DIRECT, FAKE_HASHES), true);
  assert.equal(matchesEndpointHash(POOLED, FAKE_HASHES), true);
  assert.equal(matchesEndpointHash(DIRECT.replace(FAKE_PROD, FAKE_PROD.toUpperCase()), FAKE_HASHES), true);
});

test("the options=endpoint form matches even behind a proxy host", () => {
  const viaOptions = `postgresql://owner:pw@proxy.example.com/neondb?options=endpoint%3D${FAKE_PROD}`;
  assert.equal(matchesEndpointHash(viaOptions, FAKE_HASHES), true);
});

test("a dev branch, localhost and junk do not match", () => {
  assert.equal(matchesEndpointHash(DEV, FAKE_HASHES), false);
  assert.equal(matchesEndpointHash("postgresql://u:p@localhost:5432/spikeledger", FAKE_HASHES), false);
  assert.equal(matchesEndpointHash("not a url", FAKE_HASHES), false);
});

test("the production list holds SHA-256 hashes and skips a dev branch", () => {
  assert.ok(PRODUCTION_ENDPOINT_HASHES.length > 0);
  for (const h of PRODUCTION_ENDPOINT_HASHES) assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(isProductionDatabase(DEV), false);
  assert.equal(productionRefusal("db:seed", DEV), null);
  assert.equal(productionRefusal("db:seed", ""), null);
});
