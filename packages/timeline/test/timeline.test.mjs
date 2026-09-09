import test from "node:test";
import assert from "node:assert/strict";
import { interpolateKeyframes, getFrameTime } from "../dist/index.js";

test("interpolates linearly at exact frame time", () => {
  const keys = [
    { id: "a", property: "x", time: 0, value: 0, easing: "linear" },
    { id: "b", property: "x", time: 2, value: 100, easing: "linear" },
  ];
  assert.equal(interpolateKeyframes(keys, "x", 1, 0), 50);
});

test("uses a rational frame clock", () => assert.equal(getFrameTime(45, 30), 1.5));
