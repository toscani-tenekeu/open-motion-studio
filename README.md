# Open Motion Studio

Open Motion Studio is an open-source, browser-first 2D animation editor. The
P0 prototype supports scenes, simple vector objects, text, images, keyframes,
audio metadata, portable project packages, deterministic local persistence and
real MP4/PNG rendering through the Node worker.

## Quick start

Requirements: Node.js 22+, FFmpeg, and a modern Chromium-based browser.

```bash
npm install
cp .env.example .env
npm run dev
```

Open <http://localhost:5173>. The application starts without an account or
Supabase credentials. If Supabase variables are configured, the API can be
extended to use the shared `kmerhosting` project through the prefixed migrations
in `supabase/migrations`.

## Verification

```bash
npm run preflight
npm test
npm run typecheck
npm run build
```

The render API is intentionally local-first in this prototype. It validates the
document, creates a real H.264/AAC MP4 and a PNG still, and stores artifacts in
the configured data directory. Secrets are never read by the browser bundle.

## License

Code is AGPL-3.0-or-later. Imported media remains under its own license and is
never redistributed by the project without an explicit license record.
