# ZePlay Agent Guidelines & Architectural Priorities

For every future sprint, the agent must adhere to the following priority guidelines. No new user-facing features should be introduced unless they directly improve one of the prioritized categories.

## Priority Order

1. **Availability**: Ensure zero-downtime operation, stateless server operations, and graceful fallbacks for third-party integrations (like email APIs or Redis caches).
2. **Scalability**: Eliminate database constraints, file-system locks, process isolation bottlenecks, and local disk dependencies (utilizing distributed databases, global caching, and external S3 storage).
3. **Speed**: Target sub-100ms API response rates by optimizing database indexing, caching query patterns in Redis, and minimizing execution payloads.
4. **Security**: Enforce strict session PIN-gating, robust JWT validation, secure subscription plan entitlement checks, and encrypted communications.
5. **Streaming Performance**: Provide high-performance adaptive bitrate (ABR) streaming using CDN redirection and optimized HLS chunk segments.
6. **Features**: Deprioritize non-essential feature expansion in favor of production-grade engineering hardening.

---

## Architectural Hardening Principles

* **Zero Local State**: Server instances must remain stateless. All transient state coords must reside in Redis, and permanent states in PostgreSQL.
* **Non-Blocking Execution**: Offload CPU-heavy actions (transcoding, video upload packaging) and high-latency IO calls (email dispatching) to asynchronous background workers.
* **Direct-to-CDN Distribution**: Decouple host servers from streaming bandwidth consumption by redirecting all video segment and playlist requests directly to geolocated edge CDNs.
