import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dataDir = path.resolve(process.env.OMS_DATA_DIR ?? path.join(root, "data"));
const id = process.argv[2];
if (!id) throw new Error("A render job id is required");
const jobPath = path.join(dataDir, "jobs", `${id}.json`);
const artifacts = path.join(dataDir, "artifacts");
await mkdir(artifacts, { recursive: true });
const job = JSON.parse(await readFile(jobPath, "utf8"));
job.state = "running"; job.progress = 0.08; await writeFile(jobPath, JSON.stringify(job));
const duration = Math.min(180, Math.max(1, Number(job.project.duration ?? 5)));
const fps = Math.min(60, Math.max(1, Number(job.project.fps ?? 30)));
const mp4 = path.join(artifacts, `${id}.mp4`);
const png = path.join(artifacts, `${id}.png`);
const font = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
const draw = `drawtext=fontfile=${font}:text='OPEN MOTION STUDIO':fontcolor=white:fontsize=42:x=80:y=80,drawtext=fontfile=${font}:text='API EXPLAINER':fontcolor=0xc7f36b:fontsize=76:x=80:y=220`;
function ffmpeg(args) { return new Promise((resolve, reject) => { const child = spawn("ffmpeg", ["-y", ...args], { stdio: ["ignore", "ignore", "pipe"] }); let stderr = ""; child.stderr.on("data", (chunk) => { stderr += chunk; }); child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(stderr.slice(-1000)))); }); }
try {
  await ffmpeg(["-f", "lavfi", "-i", `color=c=0x202631:s=1920x1080:r=${fps}`, "-vf", draw, "-t", String(duration), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4]);
  await ffmpeg(["-f", "lavfi", "-i", "color=c=0x202631:s=1920x1080", "-vf", draw, "-frames:v", "1", png]);
  job.state = "succeeded"; job.progress = 1; job.completedAt = new Date().toISOString();
} catch (error) { job.state = "failed"; job.error = error instanceof Error ? error.message : String(error); }
await writeFile(jobPath, JSON.stringify(job));
if (job.state === "failed") process.exitCode = 1;
