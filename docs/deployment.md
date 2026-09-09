# Deployment record

The current VPS preflight observed public address `84.247.132.49`, Nginx on
ports 80/443, and a free application candidate port of `3216` before the local
development server was started. Production should serve the built editor through
the existing Nginx instance on port 80 and proxy `/api` and `/artifacts` to
`127.0.0.1:3216`.

The P0 deployment was applied on 2026-09-09 from commit `7ae1318`. The public
health endpoint is `http://84.247.132.49/health`. The application service is
enabled as `open-motion-studio.service`; existing KmerHosting services were not
stopped or reconfigured.

```bash
sudo useradd --system --home /opt/open-motion-studio --shell /usr/sbin/nologin oms
sudo install -d -o oms -g oms /opt/open-motion-studio/data
sudo cp deploy/open-motion-studio.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now open-motion-studio.service
curl http://127.0.0.1:3216/health
```

Do not expose 3216 directly when Nginx is available. Keep secrets in
`/etc/open-motion-studio.env`, never in Git or the browser bundle.
