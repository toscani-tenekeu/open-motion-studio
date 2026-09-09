import type { Keyframe, KeyframeProperty } from "@open-motion-studio/document";

export function easeInOut(value: number): number {
  return value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
}

export function interpolateKeyframes(keyframes: Keyframe[], property: KeyframeProperty, time: number, fallback: number): number {
  const points = keyframes.filter((key) => key.property === property).sort((a, b) => a.time - b.time);
  if (!points.length) return fallback;
  if (time <= points[0].time) return points[0].value;
  if (time >= points[points.length - 1].time) return points[points.length - 1].value;
  const nextIndex = points.findIndex((point) => point.time >= time);
  const previous = points[nextIndex - 1];
  const next = points[nextIndex];
  const raw = (time - previous.time) / (next.time - previous.time);
  const progress = next.easing === "ease-in-out" ? easeInOut(raw) : raw;
  return previous.value + (next.value - previous.value) * progress;
}

export function getFrameTime(frame: number, fps: number): number {
  return frame / fps;
}
