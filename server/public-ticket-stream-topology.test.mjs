import test from "node:test";
import assert from "node:assert/strict";
import { isSingleReplicaTicketStreamEnabled } from "./public-ticket-stream-topology.mjs";

test("process-local streams require explicit single-replica confirmation", () => {
  assert.equal(isSingleReplicaTicketStreamEnabled("single_replica"), true);
  assert.equal(isSingleReplicaTicketStreamEnabled(undefined), false);
  assert.equal(isSingleReplicaTicketStreamEnabled("unknown"), false);
  assert.equal(isSingleReplicaTicketStreamEnabled("multi_replica"), false);
});
