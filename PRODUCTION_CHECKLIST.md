# Production Deployment Checklist

Use this checklist to ensure all security, database, API, and platform systems are verified and safe for production deployment.

## 1. Environment Variables & Configurations
- [ ] **Secret Keys Changed**: Ensure `JWT_SECRET_KEY` in `backend/.env` is regenerated using a strong cryptographically secure random value (`openssl rand -hex 32`).
- [ ] **No Development Defaults**: Change `JWT_SECRET_KEY` and `DATABASE_URL` from development values.
- [ ] **Production Database**: Verify `DATABASE_URL` points to a persistent PostgreSQL instance rather than local SQLite file.
- [ ] **Redis Connection**: Confirm `REDIS_URL` points to a clustered/persistent production Redis instance.
- [ ] **Transactional Mail**: Ensure `RESEND_API_KEY` is loaded and the domain for `RESEND_FROM_EMAIL` is verified on Resend dashboard.
- [ ] **SMTP Fallback**: Confirm Gmail/SMTP app settings are configured as a fallback.
- [ ] **Frontend URLs**: Confirm `FRONTEND_URL` on backend matches the client's actual hosting URL.
- [ ] **CORS Restrictions**: Replace `allow_origins=["*"]` in `backend/app/main.py` with the specific domain whitelist.

## 2. Security Auditing
- [ ] **Admin Authentication**: Confirm all `/api/admin/*` endpoints require `deps.get_current_admin_user` dependency.
- [ ] **Account Disabling Logic**: Verify disabled users (`is_active=False`) are blocked from authentication on login and current-user dependency resolution.
- [ ] **Password Security**: Confirm passwords are encrypted using bcrypt hashing in `backend/app/core/security.py`.
- [ ] **No Sensitive Logs**: Audit backend logs to verify no raw passwords or JWT tokens are written to standard outputs or files.
- [ ] **SSL Encryption**: Force HTTPS across both client and api servers.

## 3. Database & Seeding
- [ ] **Migrations Applied**: Confirm all alembic migrations are upgraded to current (`alembic upgrade head`).
- [ ] **Seeding Success**: Ensure `SubscriptionPlan` database records for both `free` and `premium` plans are populated.
- [ ] **Schema Constraint Checks**: Ensure unique database constraints (e.g. unique user email, unique subscription plan name) are applied.

## 4. Video & Ingestion Layer
- [ ] **FFmpeg Availability**: Verify `ffmpeg` and `ffprobe` binaries are installed on the host system PATH.
- [ ] **Storage Write Access**: Ensure the target directory specified in `STORAGE_DIR` (e.g. `storage/videos`) is writable by the backend execution user.
- [ ] **HLS Segment Generation**: Verify that uploaded MP4 files are successfully split into HLS chunks (`.ts` and `master.m3u8`).
- [ ] **Resume Playback**: Verify that `current_position` watch history coordinates are saved and updated during playback.

## 5. Subscription Workflows
- [ ] **Plan Limitations**: Verify Free accounts are restricted to 1 Profile maximum and Premium accounts are allowed up to 4 Profiles.
- [ ] **Downgrade Constraints**: Verify downgrades are blocked if the user has more profiles than allowed by the target tier.
- [ ] **Syncing Fields**: Verify subscription updates sync both the structural `UserSubscription` table and the legacy `subscription_plan` column on the `User` table.

## 6. Admin Panel Operations
- [ ] **Status Toggles**: Ensure administrators can disable and enable accounts.
- [ ] **Admin Roles**: Verify that administrators can promote other users to admin and demote them.
- [ ] **Self-Demotion Block**: Confirm that admins cannot demote themselves, preventing locked system state.
- [ ] **Last-Admin Protection**: Confirm that the last remaining administrator account cannot be demoted.
- [ ] **Audit logs**: Check that all modifications (logins, uploads, deletions, promotions, account toggles) generate descriptive records in the `audit_logs` table.

## 7. Build & Startup Verification
- [ ] **Backend Startup**: Start uvicorn natively and check console logs for healthy database/cache handshake.
- [ ] **Frontend Production Compilation**: Compile static assets (`npm run build`) and verify `dist/` is generated cleanly without warnings.
