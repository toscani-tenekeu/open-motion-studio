export type ProjectSize = "landscape" | "square" | "portrait";
export type ObjectKind = "rect" | "ellipse" | "line" | "arrow" | "text" | "image";
export type Easing = "linear" | "ease-in-out";
export type KeyframeProperty = "x" | "y" | "scaleX" | "scaleY" | "rotation" | "opacity";

export interface Keyframe {
  id: string;
  property: KeyframeProperty;
  time: number;
  value: number;
  easing: Easing;
}

export interface MotionObject {
  id: string;
  kind: ObjectKind;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  text?: string;
  fontSize?: number;
  locked: boolean;
  hidden: boolean;
  keyframes: Keyframe[];
  assetId?: string;
}

export interface Scene {
  id: string;
  name: string;
  duration: number;
  objects: MotionObject[];
}

export interface AudioTrack {
  id: string;
  name: string;
  sourceName: string;
  start: number;
  duration: number;
  volume: number;
}

export interface ProjectDocument {
  schemaVersion: 1;
  id: string;
  name: string;
  size: ProjectSize;
  width: number;
  height: number;
  fps: number;
  duration: number;
  revision: number;
  scenes: Scene[];
  audioTracks: AudioTrack[];
  updatedAt: string;
}

export interface ProjectLimits {
  maxObjects: number;
  maxObjectsPerScene: number;
  maxDuration: number;
}

export const PROJECT_LIMITS: ProjectLimits = {
  maxObjects: 500,
  maxObjectsPerScene: 100,
  maxDuration: 180,
};

const dimensions: Record<ProjectSize, [number, number]> = {
  landscape: [1920, 1080],
  square: [1080, 1080],
  portrait: [1080, 1920],
};

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function createDemoProject(): ProjectDocument {
  const sceneId = createId("scene");
  const objects: MotionObject[] = [
    {
      id: createId("obj"), kind: "text", name: "API title", x: 210, y: 160, width: 900, height: 100,
      scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, fill: "#f6f7fb", stroke: "transparent", strokeWidth: 0,
      text: "API REQUEST", fontSize: 82, locked: false, hidden: false, keyframes: [],
    },
    {
      id: createId("obj"), kind: "rect", name: "Request node", x: 250, y: 390, width: 460, height: 260,
      scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, fill: "#c7f36b", stroke: "#e5ffa9", strokeWidth: 4,
      locked: false, hidden: false, keyframes: [
        { id: createId("key"), property: "x", time: 0, value: 120, easing: "ease-in-out" },
        { id: createId("key"), property: "x", time: 2, value: 250, easing: "ease-in-out" },
      ],
    },
    {
      id: createId("obj"), kind: "rect", name: "Response node", x: 1210, y: 390, width: 460, height: 260,
      scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, fill: "#ff806b", stroke: "#ffb4a8", strokeWidth: 4,
      locked: false, hidden: false, keyframes: [],
    },
    {
      id: createId("obj"), kind: "arrow", name: "Request arrow", x: 760, y: 505, width: 360, height: 80,
      scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, fill: "#e9edf4", stroke: "#e9edf4", strokeWidth: 14,
      locked: false, hidden: false, keyframes: [],
    },
    {
      id: createId("obj"), kind: "text", name: "Response label", x: 1300, y: 480, width: 280, height: 100,
      scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, fill: "#171b24", stroke: "transparent", strokeWidth: 0,
      text: "200 OK", fontSize: 54, locked: false, hidden: false, keyframes: [],
    },
  ];
  return {
    schemaVersion: 1, id: createId("project"), name: "API explainer", size: "landscape", width: 1920,
    height: 1080, fps: 30, duration: 52, revision: 1,
    scenes: [
      { id: sceneId, name: "The request", duration: 18, objects },
      { id: createId("scene"), name: "The response", duration: 16, objects: objects.slice(2).map((object) => ({ ...object, id: createId("obj") })) },
      { id: createId("scene"), name: "Ship it", duration: 18, objects: objects.slice(0, 2).map((object) => ({ ...object, id: createId("obj") })) },
    ],
    audioTracks: [
      { id: createId("audio"), name: "Voiceover", sourceName: "api-explainer-voice.wav", start: 0, duration: 52, volume: 0.82 },
      { id: createId("audio"), name: "Bed", sourceName: "soft-grid.mp3", start: 0, duration: 52, volume: 0.18 },
    ],
    updatedAt: new Date().toISOString(),
  };
}

export function validateProject(project: ProjectDocument): string[] {
  const errors: string[] = [];
  const objectCount = project.scenes.reduce((sum, scene) => sum + scene.objects.length, 0);
  if (project.schemaVersion !== 1) errors.push("Unsupported document schema.");
  if (!Number.isInteger(project.fps) || project.fps < 1 || project.fps > 60) errors.push("FPS must be an integer between 1 and 60.");
  if (project.duration <= 0 || project.duration > PROJECT_LIMITS.maxDuration) errors.push("Project duration exceeds the P0 limit.");
  if (objectCount > PROJECT_LIMITS.maxObjects) errors.push("Project contains too many objects.");
  for (const scene of project.scenes) {
    if (scene.objects.length > PROJECT_LIMITS.maxObjectsPerScene) errors.push(`Scene ${scene.name} contains too many objects.`);
    if (scene.duration <= 0) errors.push(`Scene ${scene.name} must have a positive duration.`);
  }
  return errors;
}

export function setProjectSize(project: ProjectDocument, size: ProjectSize): ProjectDocument {
  const [width, height] = dimensions[size];
  return { ...project, size, width, height, revision: project.revision + 1, updatedAt: new Date().toISOString() };
}
