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

async def run_concurrency_stage(num_workers: int, headers: dict, duration_seconds: int = 5):
    latencies = []
    failures = 0
    total_requests = 0
    stop_time = time.monotonic() + duration_seconds
    
    limits = httpx.Limits(max_keepalive_connections=num_workers * 2, max_connections=num_workers * 4)

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
    async with httpx.AsyncClient(base_url=API_BASE, limits=limits, timeout=10.0) as client:
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
        print(f"\n--- TESTING CONCURRENCY LEVEL: {num_workers} CONCURRENT USERS ---")
        print(f"  Duration:         {elapsed:.2f}s")
        print(f"  Total Requests:   {total_requests}")
        print(f"  Successful Req:   {len(latencies)}")
        print(f"  Requests/sec:     {rps:.1f}")
        print(f"  Median Latency:   {median:.2f} ms")
        print(f"  P95 Latency:      {p95:.2f} ms")
        print(f"  P99 Latency:      {p99:.2f} ms")
        print(f"  Failure Rate:     {fail_pct:.2f}% ({failures} failed)")

async def main():
    print("==================================================")
    print("PHASE N: CONCURRENT CATALOGUE LOAD TEST (100,000 RECORDS)")
    print("==================================================")
    
    # Obtain auth token
    async with httpx.AsyncClient(base_url=API_BASE, timeout=10.0) as setup_client:
        email = "loaduser_concurrency_bench@example.com"
        await setup_client.post('/api/auth/register', json={'email': email, 'name': 'Load Bench User', 'password': 'Password123!'})
        resp = await setup_client.post('/api/auth/login', data={'username': email, 'password': 'Password123!'})
        token = resp.json().get('access_token', '')
        headers = {'Authorization': f'Bearer {token}'} if token else {}

        # Warm up Redis cache for all test endpoints
        for ep in ENDPOINTS:
            await setup_client.get(ep, headers=headers)

    for workers in [10, 50, 100, 250, 500]:
        await run_concurrency_stage(workers, headers, duration_seconds=5)

if __name__ == "__main__":
    asyncio.run(main())
