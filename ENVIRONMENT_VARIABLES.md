# Environment Variables Guide

This document lists all backend and frontend environment variables used in ZePlay, including details on defaults and recommended production settings.

## Backend Environment Variables (`backend/.env`)

Create a `.env` file in the `backend/` directory using the following keys:

| Variable | Description | Default (Development) | Recommended (Production) |
|---|---|---|---|
| `PROJECT_NAME` | The title of the API platform | `ZePlay API` | `ZePlay Production API` |
| `DATABASE_URL` | SQLAlchemy-compatible database connection string | `sqlite+aiosqlite:///./local_zeplay.db` | `postgresql+asyncpg://<user>:<password>@<host>:<port>/<db>` |
| `JWT_SECRET_KEY` | Hex secret key used to sign JWT session tokens | `09d25e094faa6...` (predefined) | *Generate a strong secret* (`openssl rand -hex 32`) |
| `JWT_ALGORITHM` | Algorithm used for JWT signatures | `HS256` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Lifetime of generated access token sessions | `11520` (8 days) | `1440` (24 hours) or shorter |
| `FRONTEND_URL` | The URL of the React client application (used for CORS/emails) | `http://localhost:5173` | `https://zeplay.yourdomain.com` |
| `STORAGE_DIR` | Directory where uploaded movie files and HLS segments are saved | `storage/videos` | `/var/lib/zeplay/storage` or persistent volume path |
| `REDIS_URL` | Connection string for Redis cache database | `redis://localhost:6379/0` | `redis://:<password>@<redis-host>:<port>/0` |
| `REDIS_ENABLED` | Toggle key for enabling/disabling Redis memory cache | `true` | `true` |
| `RESEND_API_KEY` | Resend API integration key for transactional emails | `re_...` | Your production Resend API token |
| `RESEND_FROM_EMAIL` | Sender address for Resend emails | `onboarding@resend.dev` | `noreply@yourdomain.com` (verified sender) |
| `SMTP_HOST` | Fallback SMTP mail server hostname | `smtp.gmail.com` | Production SMTP relay host |
| `SMTP_PORT` | Fallback SMTP mail server port | `587` | `587` (TLS) or `465` (SSL) |
| `SMTP_USERNAME` | SMTP login account username | `asjadabbaszaidi@gmail.com` | Production mail username |
| `SMTP_PASSWORD` | SMTP login account password / app password | `bviw jdsn durr coho` | Production mail credentials |
| `SMTP_FROM` | Sender address for fallback SMTP | `asjadabbaszaidi@gmail.com` | `noreply@yourdomain.com` |

---

## Frontend Environment Variables (`frontend/.env`)

Vite requires environment variables to be prefixed with `VITE_`. Put these in the `frontend/.env` file:

| Variable | Description | Default (Development) | Recommended (Production) |
|---|---|---|---|
| `VITE_API_URL` | Base endpoint URL for Axios connection to backend API | `http://localhost:8000/api` | `https://api.yourdomain.com/api` |

---

## Production Security Notes

1. **Secrets**: Never commit `.env` files to git. They are gitignored by default. Use a secrets manager (Vault, AWS Secrets Manager, GitHub Secrets, or environment parameters in hosting platforms) in production.
2. **SMTP Fallback**: The backend first tries to send transactional emails via Resend. If `RESEND_API_KEY` is not provided or fails, it falls back to the configured SMTP server. Make sure at least one is configured.
