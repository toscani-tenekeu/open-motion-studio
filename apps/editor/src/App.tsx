import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, Ellipse, FabricObject, IText, Line, Rect, Triangle } from "fabric";
import type { MotionObject, ProjectDocument, ProjectSize } from "@open-motion-studio/document";
import { createDemoProject, createId, setProjectSize } from "@open-motion-studio/document";
import { getFrameTime, interpolateKeyframes } from "@open-motion-studio/timeline";

type Tool = "select" | MotionObject["kind"] | "audio" | "settings";
type RenderState = "idle" | "queued" | "running" | "succeeded" | "failed";
const STORAGE_KEY = "oms-project-v1";
const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? "";

const icon = (name: string) => {
  const paths: Record<string, string> = {
    select: "M4 3l7 18 3-7 7-3L4 3z",
    rect: "M5 5h14v14H5z",
    ellipse: "M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0z",
    line: "M5 19L19 5",
    arrow: "M5 12h13M13 6l6 6-6 6",
    text: "M5 5h14M12 5v14M8 19h8",
    image: "M5 5h14v14H5zM5 16l4-4 3 3 2-2 5 5M16 9h.01",
    audio: "M6 18V6l12-2v12M6 18a3 3 0 1 0 3 3V9l9-2v9M18 16a3 3 0 1 0 3 3",
    undo: "M9 7L4 12l5 5M5 12h9a6 6 0 1 1 0 12",
    redo: "M15 7l5 5-5 5M19 12h-9a6 6 0 1 0 0 12",
    play: "M8 5l11 7-11 7V5z",
    pause: "M8 5v14M16 5v14",
    download: "M12 4v10M8 10l4 4 4-4M5 20h14",
    upload: "M12 16V6M8 10l4-4 4 4M5 20h14",
    lock: "M7 10V8a5 5 0 0110 0v2M5 10h14v10H5z",
    eye: "M3 12s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6zM12 15a3 3 0 100-6 3 3 0 000 6z",
    plus: "M12 5v14M5 12h14",
    chevron: "M9 18l6-6-6-6",
    settings: "M12 8a4 4 0 100 8 4 4 0 000-8zM4 12h2m12 0h2M12 4v2m0 12v2M6.3 6.3l1.4 1.4m8.6 8.6 1.4 1.4m0-11.4-1.4 1.4m-8.6 8.6-1.4 1.4",
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name] ?? paths.select} /></svg>;
};

function cloneProject(project: ProjectDocument): ProjectDocument {
  return structuredClone(project);
}

function objectFromProject(item: MotionObject): FabricObject {
  const common = { left: item.x, top: item.y, scaleX: item.scaleX, scaleY: item.scaleY, angle: item.rotation, opacity: item.opacity, fill: item.fill, stroke: item.stroke, strokeWidth: item.strokeWidth, selectable: !item.locked, visible: !item.hidden, objectId: item.id } as Record<string, unknown>;
  if (item.kind === "text") return new IText(item.text ?? "Text", { ...common, fontSize: item.fontSize ?? 48, fontFamily: "Inter, sans-serif", fill: item.fill, width: item.width } as never);
  if (item.kind === "ellipse") return new Ellipse({ ...common, rx: item.width / 2, ry: item.height / 2 } as never);
  if (item.kind === "line") return new Line([0, 0, item.width, item.height], { ...common, fill: "transparent" } as never);
  if (item.kind === "arrow") return new Triangle({ ...common, left: item.x + item.width - 28, top: item.y + item.height / 2 - 28, width: 56, height: 56, angle: 90, fill: item.fill, stroke: "transparent" } as never);
  return new Rect({ ...common, width: item.width, height: item.height, rx: item.kind === "image" ? 4 : 18, ry: item.kind === "image" ? 4 : 18 } as never);
}

function ToolButton({ tool, label, selected, onClick }: { tool: Tool; label: string; selected: boolean; onClick: () => void }) {
  return <button className={`tool-button ${selected ? "selected" : ""}`} aria-label={label} title={label} onClick={onClick}>{icon(tool)}</button>;
}

function App() {
  const [project, setProject] = useState<ProjectDocument>(() => {
    try { const saved = localStorage.getItem(STORAGE_KEY); return saved ? JSON.parse(saved) as ProjectDocument : createDemoProject(); }
    catch { return createDemoProject(); }
  });
  const [sceneIndex, setSceneIndex] = useState(0);
  const [tool, setTool] = useState<Tool>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(4.2);
  const [isPlaying, setIsPlaying] = useState(false);
  const [saveState, setSaveState] = useState("Saved locally");
  const [renderState, setRenderState] = useState<RenderState>("idle");
  const [renderUrl, setRenderUrl] = useState<string | null>(null);
  const [past, setPast] = useState<ProjectDocument[]>([]);
  const [future, setFuture] = useState<ProjectDocument[]>([]);
  const canvasElement = useRef<HTMLCanvasElement>(null);
  const canvas = useRef<Canvas | null>(null);
  const playingTimer = useRef<number | undefined>(undefined);

  const scene = project.scenes[sceneIndex] ?? project.scenes[0];
  const selected = scene?.objects.find((object) => object.id === selectedId) ?? scene?.objects[0];
  const frame = Math.round(currentTime * project.fps);

  const commit = useCallback((next: ProjectDocument) => {
    setPast((items) => [...items.slice(-24), cloneProject(project)]);
    setFuture([]);
    setProject({ ...next, revision: project.revision + 1, updatedAt: new Date().toISOString() });
    setSaveState("Saving…");
  }, [project]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(project)); setSaveState("Saved locally"); }, 450);
    return () => window.clearTimeout(timeout);
  }, [project]);

  useEffect(() => {
    if (!canvasElement.current) return;
    const instance = new Canvas(canvasElement.current, { width: 720, height: 405, backgroundColor: "#202631", preserveObjectStacking: true, selectionColor: "rgba(199,243,107,.16)", selectionBorderColor: "#c7f36b" });
    canvas.current = instance;
    instance.on("selection:created", (event) => setSelectedId((event.selected?.[0] as FabricObject & { objectId?: string })?.objectId ?? null));
    instance.on("selection:updated", (event) => setSelectedId((event.selected?.[0] as FabricObject & { objectId?: string })?.objectId ?? null));
    instance.on("selection:cleared", () => setSelectedId(null));
    return () => { instance.dispose(); canvas.current = null; };
  }, []);

  useEffect(() => {
    const instance = canvas.current;
    if (!instance || !scene) return;
    instance.clear();
    const scale = 720 / project.width;
    scene.objects.filter((object) => !object.hidden).forEach((object) => {
      const item = { ...object, x: object.x * scale, y: object.y * scale, width: object.width * scale, height: object.height * scale, fontSize: (object.fontSize ?? 48) * scale };
      const fabricObject = objectFromProject(item);
      const animatedX = interpolateKeyframes(object.keyframes, "x", currentTime, object.x) * scale;
      const animatedY = interpolateKeyframes(object.keyframes, "y", currentTime, object.y) * scale;
      fabricObject.set({ left: animatedX, top: animatedY });
      instance.add(fabricObject);
      if (object.id === selectedId) instance.setActiveObject(fabricObject);
    });
    instance.renderAll();
  }, [scene, project.width, currentTime, selectedId]);

  useEffect(() => {
    if (!isPlaying) { if (playingTimer.current) window.clearInterval(playingTimer.current); return; }
    playingTimer.current = window.setInterval(() => setCurrentTime((time) => time >= project.duration ? 0 : Number((time + 1 / project.fps).toFixed(3))), 1000 / project.fps);
    return () => { if (playingTimer.current) window.clearInterval(playingTimer.current); };
  }, [isPlaying, project.duration, project.fps]);

  const updateSelected = (changes: Partial<MotionObject>) => {
    if (!selected) return;
    const next = cloneProject(project);
    const target = next.scenes[sceneIndex].objects.find((object) => object.id === selected.id);
    if (target) Object.assign(target, changes);
    commit(next);
  };

  const addObject = (kind: MotionObject["kind"]) => {
    const next = cloneProject(project);
    const newObject: MotionObject = { id: createId("obj"), kind, name: kind === "text" ? "New text" : `New ${kind}`, x: 660, y: 260, width: kind === "text" ? 420 : 260, height: kind === "text" ? 100 : 180, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, fill: kind === "text" ? "#f6f7fb" : kind === "ellipse" ? "#ff806b" : "#c7f36b", stroke: "#f6f7fb", strokeWidth: 3, text: kind === "text" ? "New text" : undefined, fontSize: kind === "text" ? 56 : undefined, locked: false, hidden: false, keyframes: [] };
    next.scenes[sceneIndex].objects.push(newObject);
    commit(next); setSelectedId(newObject.id); setTool("select");
  };

  const undo = () => { const previous = past.at(-1); if (!previous) return; setFuture((items) => [cloneProject(project), ...items]); setPast((items) => items.slice(0, -1)); setProject(previous); };
  const redo = () => { const next = future[0]; if (!next) return; setPast((items) => [...items, cloneProject(project)]); setFuture((items) => items.slice(1)); setProject(next); };

  const exportPng = () => { const data = canvas.current?.toDataURL({ format: "png", multiplier: 2 }); if (!data) return; const link = document.createElement("a"); link.href = data; link.download = `${project.name}.png`; link.click(); };
  const exportMp4 = async () => {
    setRenderState("queued"); setRenderUrl(null);
    try {
      const response = await fetch(`${API_ORIGIN}/api/render`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project }) });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json() as { jobId: string };
      setRenderState("running");
      for (let attempt = 0; attempt < 120; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        const status = await fetch(`${API_ORIGIN}/api/render/${data.jobId}`).then((res) => res.json()) as { state: RenderState; mp4Url?: string };
        setRenderState(status.state);
        if (status.state === "succeeded") { setRenderUrl(status.mp4Url ?? null); break; }
        if (status.state === "failed") throw new Error("Render failed");
      }
    } catch (error) { console.error(error); setRenderState("failed"); }
  };

  const importProject = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = () => { try { const imported = JSON.parse(String(reader.result)) as ProjectDocument; setProject(imported); setSceneIndex(0); setSaveState("Imported locally"); } catch { setSaveState("Import failed"); } }; reader.readAsText(file);
  };

  const sceneTotal = useMemo(() => project.scenes.reduce((sum, item) => sum + item.duration, 0), [project.scenes]);
  return <div className="studio-shell">
    <header className="topbar">
      <div className="brand-mark"><span className="brand-glyph">◈</span><span>Open Motion Studio</span></div>
      <div className="project-meta"><span className="project-name">{project.name}</span><span className="save-status"><i className="status-dot" />{saveState}</span></div>
      <div className="top-actions"><button className="icon-action" title="Undo" aria-label="Undo" onClick={undo}>{icon("undo")}</button><button className="icon-action" title="Redo" aria-label="Redo" onClick={redo}>{icon("redo")}</button><span className="divider" /><button className="ghost-button" onClick={() => setIsPlaying((value) => !value)}>{icon(isPlaying ? "pause" : "play")} {isPlaying ? "Pause" : "Preview"}</button><button className="primary-button" onClick={exportMp4}>{icon("download")} Export</button></div>
    </header>
    <main className="workspace">
      <aside className="tool-rail"><div className="rail-group"><ToolButton tool="select" label="Select" selected={tool === "select"} onClick={() => setTool("select")} /><ToolButton tool="rect" label="Rectangle" selected={tool === "rect"} onClick={() => addObject("rect")} /><ToolButton tool="ellipse" label="Ellipse" selected={tool === "ellipse"} onClick={() => addObject("ellipse")} /><ToolButton tool="line" label="Line" selected={tool === "line"} onClick={() => addObject("line")} /><ToolButton tool="arrow" label="Arrow" selected={tool === "arrow"} onClick={() => addObject("arrow")} /><ToolButton tool="text" label="Text" selected={tool === "text"} onClick={() => addObject("text")} /><ToolButton tool="image" label="Image" selected={tool === "image"} onClick={() => addObject("image")} /><ToolButton tool="audio" label="Audio" selected={tool === "audio"} onClick={() => setTool("audio")} /></div><div className="rail-bottom"><ToolButton tool="settings" label="Settings" selected={false} onClick={() => setSaveState("Settings are coming in V1")} /></div></aside>
      <section className="editor-area">
        <div className="editor-toolbar"><div className="toolbar-tabs"><button className="toolbar-tab active">Canvas</button><button className="toolbar-tab">Project</button></div><div className="canvas-size"><span className="mini-label">FORMAT</span><select value={project.size} onChange={(event) => commit(setProjectSize(project, event.target.value as ProjectSize))}><option value="landscape">16:9 · 1920×1080</option><option value="square">1:1 · 1080×1080</option><option value="portrait">9:16 · 1080×1920</option></select></div><span className="zoom-label">37.5%</span></div>
        <div className="canvas-stage"><div className="canvas-frame"><canvas ref={canvasElement} /></div><span className="stage-caption">{project.width} × {project.height} · {project.fps} fps</span></div>
        <div className="scene-strip"><div className="section-label">SCENES <span>{project.scenes.length}</span></div>{project.scenes.map((item, index) => <button key={item.id} className={`scene-chip ${index === sceneIndex ? "active" : ""}`} onClick={() => { setSceneIndex(index); setCurrentTime(0); }}><span className="scene-number">0{index + 1}</span><span>{item.name}</span><b>{item.duration}s</b></button>)}<button className="add-scene" onClick={() => { const next = cloneProject(project); next.scenes.push({ id: createId("scene"), name: `Scene ${next.scenes.length + 1}`, duration: 12, objects: [] }); commit(next); }}>+</button></div>
      </section>
      <aside className="inspector"><div className="inspector-head"><span>Inspector</span><button className="more-button">•••</button></div>{selected ? <><div className="selected-object"><div className={`object-thumb ${selected.kind}`}>{selected.kind === "text" ? "T" : selected.kind === "ellipse" ? "○" : "▦"}</div><div><strong>{selected.name}</strong><span>{selected.kind} · Layer {scene.objects.indexOf(selected) + 1}</span></div><button className="mini-action" onClick={() => updateSelected({ hidden: !selected.hidden })}>{icon(selected.hidden ? "eye" : "eye")}</button></div><InspectorSection title="Transform" open><div className="field-grid"><Field label="X" value={Math.round(selected.x)} onChange={(value) => updateSelected({ x: value })} /><Field label="Y" value={Math.round(selected.y)} onChange={(value) => updateSelected({ y: value })} /><Field label="W" value={Math.round(selected.width)} onChange={(value) => updateSelected({ width: value })} /><Field label="H" value={Math.round(selected.height)} onChange={(value) => updateSelected({ height: value })} /></div><div className="field-row"><span>Rotation</span><input type="range" min="-180" max="180" value={selected.rotation} onChange={(event) => updateSelected({ rotation: Number(event.target.value) })} /><output>{Math.round(selected.rotation)}°</output></div></InspectorSection><InspectorSection title="Appearance" open><div className="field-row"><span>Opacity</span><input type="range" min="0" max="1" step=".01" value={selected.opacity} onChange={(event) => updateSelected({ opacity: Number(event.target.value) })} /><output>{Math.round(selected.opacity * 100)}%</output></div><div className="color-row"><span>Fill</span><input type="color" value={selected.fill.startsWith("#") ? selected.fill : "#ffffff"} onChange={(event) => updateSelected({ fill: event.target.value })} /></div></InspectorSection><InspectorSection title="Animation" open><div className="animation-row"><span className="key-icon">◆</span><span>Position</span><button className="key-button" onClick={() => { const next = cloneProject(project); const item = next.scenes[sceneIndex].objects.find((object) => object.id === selected.id); item?.keyframes.push({ id: createId("key"), property: "x", time: currentTime, value: selected.x, easing: "ease-in-out" }); commit(next); }}>Add keyframe</button></div><div className="ease-select"><span>Interpolation</span><select><option>Ease in-out</option><option>Linear</option></select></div></InspectorSection><InspectorSection title="Layer" open><div className="layer-actions"><button onClick={() => updateSelected({ locked: !selected.locked })}>{icon("lock")} {selected.locked ? "Unlock" : "Lock"}</button><button onClick={() => updateSelected({ hidden: !selected.hidden })}>{icon("eye")} {selected.hidden ? "Show" : "Hide"}</button></div></InspectorSection></> : <div className="empty-inspector"><span>◌</span><p>Select an object on the canvas to inspect it.</p></div>}</aside>
    </main>
    <section className="timeline-panel"><div className="timeline-toolbar"><div className="timeline-title"><span className="section-label">TIMELINE</span><span className="time-readout">{currentTime.toFixed(2)}s <em>/ {scene?.duration.toFixed(2)}s</em></span></div><div className="timeline-actions"><button className="transport-button" onClick={() => setCurrentTime(0)}>↤</button><button className="transport-button play-button" onClick={() => setIsPlaying((value) => !value)}>{icon(isPlaying ? "pause" : "play")}</button><button className="transport-button" onClick={() => setCurrentTime(Math.min(scene.duration, currentTime + 1))}>↦</button><span className="divider" /><button className="export-png" onClick={exportPng}>{icon("download")} PNG still</button>{renderState !== "idle" && <span className={`render-status ${renderState}`}>{renderState === "succeeded" && renderUrl ? <a href={renderUrl} download>Download MP4</a> : `Render ${renderState}`}</span>}</div></div><div className="timeline-body"><div className="track-labels"><span className="ruler-spacer" /><div className="track-label scene-track">Scene {String(sceneIndex + 1).padStart(2, "0")}</div><div className="track-label"><span className="track-dot lime" />{selected?.name ?? "Objects"}</div><div className="track-label"><span className="track-dot coral" />Voiceover</div><div className="track-label"><span className="track-dot blue" />Bed</div></div><div className="tracks"><div className="ruler" onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setCurrentTime(Math.max(0, Math.min(scene.duration, ((event.clientX - rect.left) / rect.width) * scene.duration))); }}><span>0s</span><span>5s</span><span>10s</span><span>15s</span><span>18s</span></div><div className="track scene-track-bar"><div className="scene-segment" style={{ width: `${(scene.duration / sceneTotal) * 100}%` }}>{scene.name}</div><div className="playhead" style={{ left: `${(currentTime / scene.duration) * 100}%` }} /></div><div className="track object-track"><div className="object-segment" style={{ width: `${Math.min(100, (scene.duration / sceneTotal) * 100)}%` }} />{(selected?.keyframes ?? []).map((key) => <span key={key.id} className="keyframe" style={{ left: `${(key.time / scene.duration) * 100}%` }} />)}<div className="playhead" style={{ left: `${(currentTime / scene.duration) * 100}%` }} /></div><div className="track audio-track"><div className="audio-segment">api-explainer-voice.wav</div></div><div className="track audio-track"><div className="audio-segment bed">soft-grid.mp3</div></div></div></div></section>
    <footer className="statusbar"><span><i className="status-dot" /> Autosave on</span><span>{project.scenes.length} scenes · {scene?.objects.length ?? 0} objects · {project.audioTracks.length} audio tracks</span><span>Visitor workspace · no account required</span><label className="import-label">{icon("upload")} Import project<input type="file" accept="application/json,.json" onChange={importProject} /></label></footer>
  </div>;
}

function InspectorSection({ title, children, open }: { title: string; children: React.ReactNode; open?: boolean }) { return <details className="inspector-section" open={open}><summary>{title}<span>{icon("chevron")}</span></summary><div className="section-content">{children}</div></details>; }
function Field({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="field"><span>{label}</span><input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>; }

export default App;
