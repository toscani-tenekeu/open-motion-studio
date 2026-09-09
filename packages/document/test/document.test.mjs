import test from "node:test";
import assert from "node:assert/strict";
import { createDemoProject, validateProject, setProjectSize } from "../dist/index.js";

test("demo project is within P0 limits", () => {
  const project = createDemoProject();
  assert.deepEqual(validateProject(project), []);
  assert.equal(project.scenes.length, 3);
});

test("size changes preserve document data", () => {
  const project = createDemoProject();
  const portrait = setProjectSize(project, "portrait");
  assert.equal(portrait.width, 1080);
  assert.equal(portrait.height, 1920);
  assert.equal(portrait.scenes.length, project.scenes.length);
});
