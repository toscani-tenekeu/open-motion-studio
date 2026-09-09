import http from "node:http";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateProject } from "@open-motion-studio/document";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dataDir = path.resolve(process.env.OMS_DATA_DIR ?? path.join(root, "data"));
const jobsDir = path.join(dataDir, "jobs");
const artifactsDir = path.join(dataDir, "artifacts");
const port = Number(process.env.OMS_PORT ?? 3216);
const jobs = new Map();
await mkdir(jobsDir, { recursive: true });
await mkdir(artifactsDir, { recursive: true });

function send(response, status, payload, headers = {}) {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  response.writeHead(status, { "Content-Type": typeof payload === "string" ? "text/plain; charset=utf-8" : "application/json; charset=utf-8", "Access-Control-Allow-Origin": process.env.OMS_PUBLIC_ORIGIN ?? "*", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", ...headers });
  response.end(body);
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function runWorker(jobId) {
  const child = spawn(process.execPath, [path.join(root, "apps/worker/index.mjs"), jobId], { cwd: root, env: { ...process.env, OMS_DATA_DIR: dataDir }, stdio: "inherit" });
  child.on("exit", (code) => { const job = jobs.get(jobId); if (job && code !== 0) { job.state = "failed"; job.error = `Worker exited with ${code}`; } });
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") return send(response, 204, "");
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  try {
    if (url.pathname === "/health") return send(response, 200, { ok: true, service: "oms-api", sha: process.env.GIT_SHA ?? "local", ffmpeg: "native" });
    if (url.pathname === "/api/render" && request.method === "POST") {
      const body = await readJson(request);
      const errors = validateProject(body.project);
      if (errors.length) return send(response, 422, { errors });
      const active = [...jobs.values()].filter((job) => ["queued", "running"].includes(job.state));
      if (active.length >= 4) return send(response, 429, { error: "Render queue is full." });
      const jobId = randomUUID();
      const job = { id: jobId, state: "queued", createdAt: new Date().toISOString(), project: body.project };
      jobs.set(jobId, job);
      await writeFile(path.join(jobsDir, `${jobId}.json`), JSON.stringify(job));
      runWorker(jobId);
      return send(response, 202, { jobId });
    }
    const renderMatch = url.pathname.match(/^\/api\/render\/([\w-]+)$/);
    if (renderMatch && request.method === "GET") {
      let job;
      try {
        job = JSON.parse(await readFile(path.join(jobsDir, `${renderMatch[1]}.json`), "utf8"));
      } catch (error) {
        if (error?.code === "ENOENT") return send(response, 404, { error: "Render job not found" });
        throw error;
      }
      jobs.set(renderMatch[1], job);
      return send(response, 200, { id: job.id, state: job.state, progress: job.progress ?? 0, mp4Url: job.state === "succeeded" ? `/artifacts/${job.id}.mp4` : undefined, pngUrl: job.state === "succeeded" ? `/artifacts/${job.id}.png` : undefined, error: job.error });
    }
    const artifactMatch = url.pathname.match(/^\/artifacts\/([\w-]+)\.(mp4|png)$/);
    if (artifactMatch && request.method === "GET") {
      const file = path.join(artifactsDir, `${artifactMatch[1]}.${artifactMatch[2]}`);
      if (!existsSync(file)) return send(response, 404, "Not found");
      const contentType = artifactMatch[2] === "mp4" ? "video/mp4" : "image/png";
      response.writeHead(200, { "Content-Type": contentType, "Content-Length": (await stat(file)).size, "Cache-Control": "private, max-age=3600" });
      return response.end(await readFile(file));
    }
    return send(response, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    return send(response, 500, { error: "Internal server error" });
  }
});

server.listen(port, "0.0.0.0", () => console.log(`OMS API listening on http://0.0.0.0:${port}`));
