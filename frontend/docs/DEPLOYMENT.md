# Frontend Compatibility & Same-VPS Deployment Guide

## 1. Compatibility & Migration Status

**Status: Frontend migrated to the authoritative `/api/v1` Go backend contract (`approved-v2`). Local automated gates and selected integrated browser smoke flows passed against Go backend + temporary synthetic SQLite data. Full interactive browser E2E and live production VPS deployment remain unexecuted; no production certification claimed.**

### Implemented Alignment

| Area | Migrated Frontend Implementation | Authoritative Backend Contract |
| --- | --- | --- |
| HTTP & API client | [src/lib/api-client.ts](../src/lib/api-client.ts) and [src/lib/lms-api.ts](../src/lib/lms-api.ts) use `fetch(..., { credentials: "include" })`, `Content-Type: application/json` (default `{}`), `X-CSRF-Token`, `Idempotency-Key`, `{ data, error }` unwrapping, server `Date` clock offset, and full pagination helpers (`fetchAllPages`). | 94 `/api/v1` routes (`approved-v2`) documented in [backend-docs/API_DEFINITIONS.md](../backend-docs/API_DEFINITIONS.md). |
| State & persistence | [src/state/auth-provider.tsx](../src/state/auth-provider.tsx) holds user + `csrf_token` in memory only; all `src/mocks/` and `localStorage`/`sessionStorage`/`IndexedDB` usage removed. | Server-authoritative state, SQLite persistence (local filesystem, one API writer; see [backend-docs/DEPLOYMENT.md](../backend-docs/DEPLOYMENT.md)), and server-side grading/timers. |
| Auth & roles | `/login`, `/auth/me` restore, `/auth/logout`, `/auth/change-password`; role routes `/admin`, `/manager` (`class_manager`), `/student` (legacy `/teacher` redirects safely to `/manager`). Demo switchers removed. | `lms_session` (`HttpOnly; Secure; SameSite=Lax`) cookie, `X-CSRF-Token` on authenticated writes, exact `Origin` check on non-GET requests. |
| DTOs & profiles | [src/types/api.ts](../src/types/api.ts) uses exact `snake_case` DTOs, integer IDs, `admin \| class_manager \| student`, and required 9-digit MSSV / `@sis.hust.edu.vn` / `school_or_institute` / `university_class` / VN phone fields for students. | Exact wire DTOs and validation rules in `backend/internal/app/`. |
| Workflows | Accounts, class CRUD + `total_sessions` lock, student preview & enrollment cycles, Manager schedule draft/submit -> Admin approve/reject, code attendance (`remaining_attempts`) & auto-approved absence, attendance override, HTTPS link library, paginated in-app notifications, server progress (`incomplete_reasons`), and serialized quiz draft autosave (`expected_revision`) + `Idempotency-Key` submit + `409` refetch reconciliation. | Server enforces permissions, continuous quiz timers, `2/3` test manual-submit rule, and grading without exposing answer keys (`review: null`). |
| Routing & build | Next.js 16 + React 19 with runtime dynamic routes (`/[role]/[section]`, `/[role]/classes/[classId]`, `/[role]/classes/[classId]/quizzes/[quizId]`). Local dev proxy via loopback-only `BACKEND_PROXY_TARGET` in [next.config.ts](../next.config.ts). | Production nginx serves `/` -> `127.0.0.1:5002` and `/api/v1/` -> `127.0.0.1:5001`. |

### Remaining Limits & Non-Goals

- **Selected browser smoke, not full E2E**: On 2026-11-15, integrated VS Code browser checks ran against local Go backend at `127.0.0.1:15301` and Next dev server at `localhost:15300` using `BACKEND_PROXY_TARGET` and temporary synthetic SQLite data outside the repository. Seed data was isolation-only, not shipped demo data. Cookie login worked without manual cookie injection. Admin dashboard showed 100 students, 3 managers, 3 classes; UI-created manager returned `POST /admin/users` 201 and appeared in refreshed list. Manager logged in, created assignment through form with one single-choice question, 2-minute duration, 10 attempts, previewed and published it. Student logged in, opened class quiz, started attempt 1, selected answer; autosave draft revision 1 survived full browser reload with answer still checked. Server submission scored 100% (1/1); response `review: null` exposed no detailed answer key. Second start created distinct attempt ID 2, `attempt_number` 2, `in_progress`. At 390×844, quiz runner had no horizontal overflow; document width was 375 px, and browser `localStorage`/`sessionStorage` were empty. Student visiting admin saw `Không đúng vai trò truy cập` and no admin data; this was not an auto-redirect.
- **Browser coverage limits**: Scheduling, attendance, enrollment, notifications, grants, browser `409` conflict, and test unlock were not exercised. Browser console included expected auth `401`/active-attempt `404` and Next aborted-prefetch/font-preload warnings; this was not clean-console certification. No full 94-route E2E, load/performance certification, or live VPS rollout was performed.
- **Automated gates**: `npm test` passed 16/16; `npm run typecheck`, `npm run lint`, `git diff --check`, and production build passed. These complement selected browser smoke only; they do not establish full E2E or production certification.
- **Unsupported workflows omitted**: Certificates, file uploads, email notifications, and client-side quiz answer keys/scoring have no backend endpoints and are not shipped.
- **Build-time Next.js `rewrites()`**: `BACKEND_PROXY_TARGET` in `next.config.ts` is evaluated at dev startup or `next build`; changing it only when running `next start` does not change built rewrites. Leave it unset for production builds behind nginx: nginx routes `/api/v1/` directly to `127.0.0.1:5001`.
- **Backend immutability**: `backend/` and `backend-docs/` remain untouched.

---

## 2. Deployment Architecture

### Option A: Recommended Runnable Hosting (Current Next.js Source)

Run Next.js as a private Node.js service on `127.0.0.1:5002` behind nginx on `127.0.0.1:5000`:

- `https://lms-demo.tuanmnk8.me` (Cloudflare Tunnel / trusted local HTTPS ingress) -> `http://127.0.0.1:5000` (nginx)
- `/api/v1/*` -> `http://127.0.0.1:5001` (existing backend)
- `/*` -> `http://127.0.0.1:5002` (Next.js `next start`)

**Key rules:**
- Nginx owns `127.0.0.1:5000`; Next.js must bind to `127.0.0.1:5002` (never `5000`).
- Neither `proxy_pass` may have a trailing slash, so full paths (`/api/v1/...` and `/...`) are preserved.
- Preserve `Origin` (`proxy_set_header Origin $http_origin;`), `Host $host`, `X-Forwarded-For $real_client_ip`, and `X-Forwarded-Proto https`.
- Do **not** use `proxy_add_x_forwarded_for`; forward the single overwritten `$real_client_ip`.
- `CF-Connecting-IP` is trusted **only** because loopback ingress (`127.0.0.1:5000`) is a trusted local Cloudflare Tunnel. The `map` is not authentication; local processes can spoof headers, so never expose ports `5000`, `5001`, or `5002` publicly.
- `X-Forwarded-Proto https` is valid only for this HTTPS tunnel topology. Never disable `Secure` cookies or add wildcard CORS.
- Do **not** add SPA `try_files ... /index.html` for Next.js.

#### Nginx `http` Context (`map`)

Place in `/etc/nginx/conf.d/real-client-ip.conf` (inside `http {}`, avoid duplicate `map` definitions):

```nginx
map $http_cf_connecting_ip $real_client_ip {
    default $http_cf_connecting_ip;
    ""      $remote_addr;
}
```

#### Nginx `server` Block (`/etc/nginx/sites-available/lms-demo.tuanmnk8.me`)

```nginx
server {
    listen 127.0.0.1:5000;
    server_name lms-demo.tuanmnk8.me;

    location /api/v1/ {
        client_max_body_size 1m;
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Origin $http_origin;
        proxy_set_header X-Forwarded-For $real_client_ip;
        proxy_set_header X-Forwarded-Proto https;
    }

    location / {
        proxy_pass http://127.0.0.1:5002;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_set_header Host $host;
        proxy_set_header Origin $http_origin;
        proxy_set_header X-Forwarded-For $real_client_ip;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

### Option B: Conditional Future Static SPA (Not Deployable Today)

The current Next.js checkout outputs `.next/`, **not** `dist/` or `out/`. Do not set `output: "export"` blindly because dynamic routes (`/[role]/[section]`, `/[role]/classes/[classId]`) have no `generateStaticParams`.

Only if a future, separately approved static build emits `/opt/o365-lms/frontend/dist/index.html` and passes dynamic-route refresh acceptance, you can stop the Node service, preserve the `/api/v1/` backend `location` block from Option A, and replace only the Node `location /` block with:

```nginx
    root /opt/o365-lms/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
```

Do **not** attempt to deploy Next.js by copying `.next/` to `dist/`.

---

## 3. Repository & VPS Layout

- **Repository**: The repo root is the frontend source (`src/`, `package.json`). There is no nested `frontend/` folder.
- **VPS**: Deploy the frontend checkout to `/opt/o365-lms/frontend`. Do not move local `src/` or assume a nested path.
- **Database**: See [backend-docs/](../backend-docs/) for backend database operations. Never seed or reset the production database from frontend deployment steps.

---

## 4. Operator Deployment Steps

**Prerequisites:** Debian/Ubuntu, `nginx`, `systemd`, Node.js `22.16+` (22 LTS), healthy backend on `127.0.0.1:5001`, and existing Cloudflare Tunnel forwarding `https://lms-demo.tuanmnk8.me` to `http://127.0.0.1:5000`. Actual service edits and reloads require explicit admin approval.

### Backend Operator Config Checks (Read-Only)

Backend source is immutable. Verification ran a separate backend process against temporary synthetic data only; no existing backend service, database, or configuration was changed. If any production setting below mismatches, **stop and block deployment** rather than silently changing it:

| Variable | Expected Value | Purpose |
| --- | --- | --- |
| `HTTP_ADDR` | `127.0.0.1:5001` | Private loopback bind behind nginx. |
| `SITE_ORIGIN` | `https://lms-demo.tuanmnk8.me` | Exact origin required for non-GET writes (localhost dev origin cannot be used for production writes; current frontend has no env client setting to connect). |
| `TRUSTED_PROXY_CIDRS` | `127.0.0.1/32` | Trusts nginx-overwritten single `X-Forwarded-For` header. |
| `JWT_SECRET` | Existing private config | Required; do not expose or rotate during frontend deploy. |

1. **Prepare unprivileged deploy user & directory** (if missing):
   ```bash
   id -u o365-frontend >/dev/null 2>&1 || sudo useradd --create-home --shell /bin/bash o365-frontend
   sudo install -d -o o365-frontend -g o365-frontend /opt/o365-lms/frontend
   ```
   *(Own only `/opt/o365-lms/frontend`. Never run recursive `chown` on backend directories.)*

2. **Stage source & build as `o365-frontend`**:
   - **Fresh, empty path only:** Clone and checkout the approved commit (no tokens in commands). Replace `REPLACE_WITH_APPROVED_COMMIT_SHA` before running; the commit must contain the frontend source and lockfile to deploy:
     ```bash
     sudo -u o365-frontend -H bash -c 'git clone https://github.com/chinsiuuu1412/training-o365.git /opt/o365-lms/frontend && cd /opt/o365-lms/frontend && git checkout --detach REPLACE_WITH_APPROVED_COMMIT_SHA'
     ```
   - **Existing installation:** Preserve the current known-good artifact (`src/`, `package-lock.json`, `.next/`, `node_modules/`) before updating, and either stage the new build separately or stop only `o365-lms-frontend` during maintenance so you do not build over an active `.next/`.
   - **Install, typecheck, and build** (do **not** set `NODE_ENV=production` before `npm ci`, as devDependencies are required for typecheck/build):
     ```bash
     sudo -u o365-frontend -H bash -c 'cd /opt/o365-lms/frontend && npm ci && npm run typecheck && npm run build'
     ```
   - *(Optional manual smoke test: `sudo -u o365-frontend -H bash -c 'cd /opt/o365-lms/frontend && npm run start -- --hostname 127.0.0.1 --port 5002'`. Stop this manual process before starting `systemd` to avoid a `5002` bind conflict.)*

3. **Verify Node path for `o365-frontend`**:
   ```bash
   sudo -u o365-frontend -H sh -c 'command -v node && node --version'
   ```
   Use the exact absolute path (e.g. `/usr/bin/node`) in the systemd unit. Ensure `.next/cache` remains writable only by `o365-frontend`.

4. **Create `/etc/systemd/system/o365-lms-frontend.service`**:
   ```ini
   [Unit]
   Description=Học Việt LMS Frontend (Next.js)
   After=network.target

   [Service]
   Type=simple
   User=o365-frontend
   Group=o365-frontend
   WorkingDirectory=/opt/o365-lms/frontend
   Environment=NODE_ENV=production
   ExecStart=/usr/bin/node /opt/o365-lms/frontend/node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 5002
   Restart=on-failure
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```

5. **Enable, start (or restart on update) the frontend service**:
   - Initial start: `sudo systemctl daemon-reload && sudo systemctl enable --now o365-lms-frontend`
   - Update (`enable --now` does not restart an already-running service): `sudo systemctl restart o365-lms-frontend`
   - Check status:
     ```bash
     sudo systemctl status o365-lms-frontend --no-pager
     sudo journalctl -u o365-lms-frontend -n 50 --no-pager
     ```

6. **Configure nginx**:
   - Add the `map` snippet to `/etc/nginx/conf.d/real-client-ip.conf`.
   - Add the `server` block to `/etc/nginx/sites-available/lms-demo.tuanmnk8.me`.
   - Symlink into `sites-enabled/` without `-f` (check existing link first; reuse only if it points to `/etc/nginx/sites-available/lms-demo.tuanmnk8.me`, otherwise stop and inspect). Do not delete default sites.
     ```bash
     readlink -f /etc/nginx/sites-enabled/lms-demo.tuanmnk8.me
     # Only if missing:
     sudo ln -s /etc/nginx/sites-available/lms-demo.tuanmnk8.me /etc/nginx/sites-enabled/lms-demo.tuanmnk8.me
     sudo nginx -t && sudo systemctl reload nginx
     ```
   - *(Note: `sudo nginx -T` outputs full active config; review privately if checking for `server_name` collisions.)*

---

## 5. Verification, Diagnostics & Rollback

*(Local automated gates and selected integrated browser smoke ran; see status above. Full browser E2E and live VPS deployment at `https://lms-demo.tuanmnk8.me` remain unexecuted.)*

### Per-Hop `curl` Checks

```bash
# 1. Direct Next.js worker (expect 200 HTML for / and /login)
curl -i -H "Host: lms-demo.tuanmnk8.me" http://127.0.0.1:5002/login

# 2. Nginx root & login page (expect 200 HTML)
curl -i -H "Host: lms-demo.tuanmnk8.me" http://127.0.0.1:5000/login

# 3. Nested dynamic route (expect 200 HTML; client redirects unauthenticated users to /login)
curl -i -H "Host: lms-demo.tuanmnk8.me" http://127.0.0.1:5000/student/classes

# 4. Next.js static asset (extract actual /_next/static/... path from page HTML)
curl -i -H "Host: lms-demo.tuanmnk8.me" "http://127.0.0.1:5000/_next/static/<actual-asset-path>"

# 5. Backend API via nginx (expect HTTP 401 JSON with Cache-Control: no-store;
#    there is no /health endpoint)
curl -i -H "Host: lms-demo.tuanmnk8.me" http://127.0.0.1:5000/api/v1/auth/me

# 6. Public HTTPS route (expect HTTP 401 JSON)
curl -i https://lms-demo.tuanmnk8.me/api/v1/auth/me
```

### Browser Acceptance (Operator Checklist After Rollout)

- **Login & session restore** (`/login`, `/`): Sign in as `admin`, `class_manager` (`/manager`), and `student`; reload pages to verify `/api/v1/auth/me` restores without storage or console errors.
- **Role workflows**: Verify account/class CRUD, enrollment cycles, Manager schedule draft/submit -> Admin approval, code attendance (`remaining_attempts`), quiz autosave (`expected_revision`) + `Idempotency-Key` submit, HTTPS link library, and paginated notifications.

### Diagnostics

- `502 Bad Gateway`: Upstream (`127.0.0.1:5001` or `127.0.0.1:5002`) is down or unreachable.
- `403 Forbidden` on `/api/v1/`: `Origin` or `X-CSRF-Token` mismatch; inspect JSON `error.code`.
- `200 OK` returning HTML on `/api/v1/`: Request misrouted to Next.js instead of backend.
- `404 Not Found` on `/api/v1/`: Wrong `proxy_pass` rewrite (check for unwanted trailing slash).

### Rollback

1. Preserve the previous known-good frontend artifact (source, `package-lock.json`, production `.next/`, and `node_modules/`) before updating.
2. Stop only the frontend service: `sudo systemctl stop o365-lms-frontend`.
3. Restore the matching approved frontend artifact to `/opt/o365-lms/frontend`.
4. Start the service and verify with `curl`: `sudo systemctl start o365-lms-frontend && curl -i -H "Host: lms-demo.tuanmnk8.me" http://127.0.0.1:5002/`.
5. If nginx config changed, restore the known-good nginx config and run `sudo nginx -t && sudo systemctl reload nginx`.
6. Never delete or modify the backend database or backend service.
