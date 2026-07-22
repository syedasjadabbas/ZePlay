# Deployment Guide

This document describes how to deploy ZePlay to staging or production environments.

## System Prerequisites
Ensure the target server has the following installed:
1. **Docker & Docker Compose** (Preferred for microservices orchestration)
2. **FFmpeg & FFprobe** on system environment PATH (CRITICAL for HLS video processing)
3. **Node.js v18+ & NPM** (For building the static React frontend)
4. **Python 3.11** (If deploying natively without Docker containers)
5. **Redis v6.0+** (For caching layer support)

---

## Option A: Docker Compose Deployment (Recommended)

This is the fastest path to boot all system services (PostgreSQL, Redis, Backend, Frontend) inside secure container boundaries.

### 1. Setup Configuration files
In the project root, make sure your backend `.env` is fully set up (refer to `ENVIRONMENT_VARIABLES.md` for options). 

### 2. Launch Services
Run the following command to build and launch all containers in detached mode:
```bash
docker-compose up -d --build
```

The system automatically orchestrates the following:
- Spins up a PostgreSQL database (`zeplay-db`) and runs health checks.
- Spins up the FastAPI service (`zeplay-backend`), waits for PostgreSQL, runs all Alembic migrations to the latest revision, and boots Uvicorn on port `8000`.
- Spins up the Vite React application (`zeplay-frontend`) on port `5173`.

### 3. Verify Container Status
Check service logs to ensure correct startup:
```bash
docker-compose ps
docker-compose logs -f backend
```

---

## Option B: Native VM/VPS Deployment (Manual)

If you prefer deploying without Docker on a traditional Virtual Private Server (VPS), follow these steps:

### 1. Backend Service Setup
1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: .\venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install --no-cache-dir -r requirements.txt
   ```
4. Configure database and system keys in `backend/.env`.
5. Run Alembic migrations:
   ```bash
   alembic upgrade head
   ```
6. Start the production backend server using Uvicorn:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
   ```

### 2. Frontend Assets Compilation
1. Navigate to the `frontend/` directory:
   ```bash
   cd ../frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Configure `frontend/.env` to point `VITE_API_URL` to your domain backend api route.
4. Build the production-ready static assets:
   ```bash
   npm run build
   ```
5. Deploy the resulting `/dist` folder to your static hosting provider (e.g., Vercel, Netlify, AWS S3 + CloudFront) or serve it via Nginx.

---

## Reverse Proxy Setup (Nginx Example)

To serve ZePlay securely under standard HTTPS (port 443), deploy Nginx as a reverse proxy:

```nginx
server {
    listen 80;
    server_name zeplay.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name zeplay.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/zeplay.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/zeplay.yourdomain.com/privkey.pem;

    # Frontend Static Files
    location / {
        root /var/www/zeplay/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API Proxy
    location /api {
        proxy_pass http://127.0.0.1:8000/api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Transactional Email Setup

ZePlay uses **Resend** as its primary email delivery system (with Gmail SMTP as fallback). 

To ensure registration and password reset emails are delivered successfully:
1. Register on [Resend.com](https://resend.com) and verify your domain (`zeplay.tech` or `zeploy.tech`).
2. Add the following environment variables to your production backend config:
   ```bash
   EMAIL_PROVIDER="resend"
   EMAIL_FROM="noreply@zeploy.tech"
   RESEND_API_KEY="re_your_api_key_here"
   ```
3. If using SMTP as a fallback, configure `EMAIL_PROVIDER="smtp"`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, and `SMTP_PASSWORD` (App Password).

