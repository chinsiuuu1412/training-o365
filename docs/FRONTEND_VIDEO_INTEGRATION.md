# Video / media integration — deferred beyond MVP

**2026-11-15: obsolete live-media integration guide replaced.** Approved-v2 backend does not provide upload, photo proof, presigned URLs, playback runs/heartbeats, trusted duration, watched-video credit, watch-review or telemetry endpoints. Legacy storage/provider/cleanup code/config/commands removed. Do not follow older media instructions or reintroduce them through frontend work.

## Current supported behavior

- [Approved workflow](new-approved/user-workflow-guideline.md), [API contract](API_DEFINITIONS.md), [frontend handoff](FRONTEND_SURFACE_CONTRACT.md).
- Manager creates/updates HTTPS Library links with `material_type:document|video`, title/description, optional same-class session_id and optional expires_at. Admin cannot create; both staff roles remove with JSON reason; Admin removal notifies Manager.
- Student accesses permitted link through class materials list/detail only while currently enrolled and class unexpired. Removed/expired items hidden from Student list; detail denies them. Assigned staff retain historical GET metadata.
- Video hosts `youtube.com`, `www.youtube.com`, `m.youtube.com`, `youtu.be`, `www.youtube-nocookie.com` exempt material-specific expiry only. Class expiry, removal and enrollment restrictions still apply.
- Watching a link **never grants Attendance**. Attendance code/Manager override independent of video and Quiz. External links already learned cannot be revoked by LMS; external provider sharing/access policy not controlled by backend.
- Backend stores metadata/URL only; does not fetch arbitrary links or provider duration. No R2/SMTP/YouTube API setup required. No media runtime or external-service verification claimed.

## Deferred design boundary

Uploads/private storage, proof validation, signed URLs, provider adapters, coverage accounting, seek/heartbeat handling, watch review, retention/cleanup and associated audit/security/accessibility need separate approved product/API design before implementation. No runnable recipe supplied for absent functionality.

Existing frontend is unchanged legacy slice, not v2-compatible media UI. Preserve [design tokens](DESIGN.md), hide/replace unsupported controls during separately approved adaptation, never report upload/email/watch-credit success from mocks. Browser/video/provider checks remain outstanding, not required or run for docs-only phase.
