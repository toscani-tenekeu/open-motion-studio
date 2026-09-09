import test from "node:test";
import assert from "node:assert/strict";
import { validateProject } from "@open-motion-studio/document";

test("invalid duration is rejected before queueing", () => {
  const project = { schemaVersion: 1, fps: 30, duration: 181, scenes: [] };
  assert.equal(validateProject(project).length, 1);
});
