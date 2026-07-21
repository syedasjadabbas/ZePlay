# ZePlay: System Design & Architecture Docs (Sprint 1 MVP)

This document describes the high-level architecture details for ZePlay, focusing on the Sprint 1 MVP foundation.

---

## 1. System Topology

```
                  ┌──────────────────────────────────────────────┐
                  │                 Users Client                 │
                  │        (React, TS, Vite, Tailwind CSS)       │
                  └──────────────────────┬───────────────────────┘
                                         │ HTTPS (REST)
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │               FastAPI Backend                │
                  │      (Core Security, Users, Profiles)        │
                  └──────────────────────┬───────────────────────┘
                                         │ Async Connection (asyncpg)
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │              PostgreSQL Datastore            │
                  │           (Persistent Tables, schemas)       │
                  └──────────────────────────────────────────────┘
```

---

## 2. Core Entities

### 1. User
Represents account authentication credentials, registration timestamps, and billing plans.
* Fields: `user_id` (UUID), `email` (Unique VARCHAR), `name` (VARCHAR), `password_hash` (VARCHAR), `subscription_plan` (VARCHAR), `created_at` (Timestamp), `updated_at` (Timestamp).

### 2. Profile
Represents sub-users within an account (e.g., family members).
* Enforced Limit: Up to **4 profiles** per user.
* Fields: `profile_id` (UUID), `user_id` (UUID FK), `display_name` (VARCHAR), `avatar_url` (VARCHAR), `is_kids_profile` (BOOLEAN), `language_pref` (VARCHAR), `created_at` (Timestamp).

---

## 3. JWT Authentication Policy

We use symmetric JWT signature tokens (`HS256` encryption):
* **Payload Claim**: Holds the `sub` parameter corresponding to the `user_id` identifier.
* **Token Issuance**: Handled on successful login via `POST /api/auth/login`.
* **Access Restricting Guard**: Handled in API routing by verifying tokens against the application's unique `JWT_SECRET_KEY` signing variable.
