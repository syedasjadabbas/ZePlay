import asyncio
import time
import httpx
import random

API_BASE = "http://127.0.0.1:8000"

ENDPOINTS = [
    "/api/catalog/movies?limit=40&offset=0",
    "/api/catalog/movies?limit=40&offset=120",
    "/api/catalog/movies?genre=Action&limit=40",
    "/api/catalog/search?q=Dark&limit=40",
    "/api/catalog/search?q=Protocol&limit=40",
    "/api/catalog/search/suggestions?q=Dar&limit=5",
    "/api/recommendations/trending?limit=10",
    "/api/recommendations/popular?limit=10",
]

async def test_level(num_workers: int, duration_seconds: int = 5):
    async with httpx.AsyncClient(base_url=API_BASE, timeout=10.0) as setup_client:
        email = f"loaduser_c_{num_workers}@example.com"
        await setup_client.post('/api/auth/register', json={'email': email, 'name': 'Load User', 'password': 'Password123!'})
        resp = await setup_client.post('/api/auth/login', data={'username': email, 'password': 'Password123!'})
        token = resp.json().get('access_token', '')
        headers = {'Authorization': f'Bearer {token}'} if token else {}

        # Warm up Redis cache for all test endpoints
        for ep in ENDPOINTS:
            await setup_client.get(ep, headers=headers)

    latencies = []
    failures = 0
    total_requests = 0
    stop_time = time.monotonic() + duration_seconds
    
    limits = httpx.Limits(max_keepalive_connections=num_workers * 2, max_connections=num_workers * 4)
    timeout = httpx.Timeout(10.0)

    async def worker(client: httpx.AsyncClient):
        nonlocal total_requests, failures
        while time.monotonic() < stop_time:
            url = random.choice(ENDPOINTS)
            t0 = time.monotonic()
            try:
                r = await client.get(url, headers=headers)
                t1 = time.monotonic()
                if r.status_code == 200:
                    latencies.append((t1 - t0) * 1000)
                else:
                    failures += 1
            except Exception:
                failures += 1
            total_requests += 1

    t_start = time.monotonic()
    async with httpx.AsyncClient(base_url=API_BASE, limits=limits, timeout=timeout) as client:
        tasks = [asyncio.create_task(worker(client)) for _ in range(num_workers)]
        await asyncio.gather(*tasks)
    t_end = time.monotonic()
    
    elapsed = t_end - t_start
    rps = len(latencies) / elapsed if elapsed > 0 else 0
    
    if latencies:
        latencies.sort()
        n = len(latencies)
        median = latencies[int(n * 0.50)]
        p95 = latencies[int(n * 0.95)]
        p99 = latencies[int(n * 0.99)] if n >= 100 else latencies[-1]
        fail_pct = (failures / total_requests) * 100 if total_requests > 0 else 0
        print(f"Workers: {num_workers:3d} | RPS: {rps:6.1f} | Med: {median:6.2f}ms | P95: {p95:6.2f}ms | P99: {p99:6.2f}ms | Fail: {fail_pct:4.2f}%")

async def main():
    print("Testing Concurrency Benchmark with Warm Redis Cache...")
    for w in [10, 50, 100, 250, 500]:
        await test_level(w, 5)

if __name__ == "__main__":
    asyncio.run(main())
