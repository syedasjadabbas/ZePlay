import asyncio
import time
import httpx
import asyncpg

async def run_explain(conn, query_name, sql, params=()):
    print(f"\n--- EXPLAIN ANALYZE: {query_name} ---")
    explain_sql = f"EXPLAIN ANALYZE {sql}"
    rows = await conn.fetch(explain_sql, *params)
    for r in rows:
        print("  ", r[0])

async def benchmark_phase_e():
    conn = await asyncpg.connect('postgresql://postgres:postgres@127.0.0.1:5432/zeplay')
    
    total = await conn.fetchval('SELECT COUNT(*) FROM movies;')
    real = await conn.fetchval('SELECT COUNT(*) FROM movies WHERE is_generated = false OR is_generated IS NULL;')
    gen = await conn.fetchval('SELECT COUNT(*) FROM movies WHERE is_generated = true;')
    db_size = await conn.fetchval("SELECT pg_size_pretty(pg_database_size('zeplay'));")
    
    print("==================================================")
    print("PHASE E: 100,000 RECORD BENCHMARK & QUERY ANALYSIS")
    print("==================================================")
    print(f"Total Movies:     {total}")
    print(f"Real Movies:      {real}")
    print(f"Generated Movies: {gen}")
    print(f"Database Size:    {db_size}")
    
    # 1. EXPLAIN ANALYZE tests directly against PostgreSQL
    await run_explain(
        conn,
        "1. Catalogue Browse First Page (offset=0, limit=40)",
        "SELECT m.movie_id, m.title, m.release_year, m.created_at FROM movies m ORDER BY m.title LIMIT 40 OFFSET 0"
    )
    
    await run_explain(
        conn,
        "2. Catalogue Browse Later Page (offset=1000, limit=40)",
        "SELECT m.movie_id, m.title, m.release_year, m.created_at FROM movies m ORDER BY m.title LIMIT 40 OFFSET 1000"
    )

    await run_explain(
        conn,
        "3. Catalogue Browse Deep Page (offset=50000, limit=40)",
        "SELECT m.movie_id, m.title, m.release_year, m.created_at FROM movies m ORDER BY m.title LIMIT 40 OFFSET 50000"
    )

    await run_explain(
        conn,
        "4. Title Search Trigram Match (q='Dark')",
        "SELECT m.movie_id, m.title FROM movies m WHERE m.title ILIKE $1 ORDER BY m.created_at DESC LIMIT 40",
        ('%dark%',)
    )

    await run_explain(
        conn,
        "5. Substring Search (q='Protocol')",
        "SELECT m.movie_id, m.title FROM movies m WHERE m.title ILIKE $1 ORDER BY m.created_at DESC LIMIT 40",
        ('%protocol%',)
    )

    await run_explain(
        conn,
        "6. Genre Filter (genre='Action')",
        "SELECT m.movie_id, m.title FROM movies m JOIN movie_genres mg ON m.movie_id = mg.movie_id JOIN genres g ON mg.genre_id = g.genre_id WHERE g.name ILIKE $1 LIMIT 40",
        ('Action',)
    )

    await run_explain(
        conn,
        "7. Combined Search + Genre + Sort",
        "SELECT m.movie_id, m.title FROM movies m JOIN movie_genres mg ON m.movie_id = mg.movie_id JOIN genres g ON mg.genre_id = g.genre_id WHERE m.title ILIKE $1 AND g.name ILIKE $2 ORDER BY m.created_at DESC LIMIT 40",
        ('%dark%', 'Action')
    )

    await conn.close()

    # 2. HTTP API Latency Testing
    print("\n==================================================")
    print("HTTP API BENCHMARKS (FastAPI + Redis + PostgreSQL)")
    print("==================================================")
    
    async with httpx.AsyncClient(base_url='http://127.0.0.1:8000', timeout=30.0) as client:
        # Register/login user for token (use loaduser_ so is_verified=True)
        await client.post('/api/auth/register', json={'email': 'loaduser_bench_e@example.com', 'name': 'Bench E User', 'password': 'Password123!'})
        login = await client.post('/api/auth/login', data={'username': 'loaduser_bench_e@example.com', 'password': 'Password123!'})
        token = login.json().get('access_token', '')
        headers = {'Authorization': f'Bearer {token}'} if token else {}

        async def measure(name, url):
            times = []
            for _ in range(5):
                t0 = time.monotonic()
                r = await client.get(url, headers=headers)
                t1 = time.monotonic()
                assert r.status_code == 200, f"Error {r.status_code}: {r.text}"
                times.append((t1 - t0) * 1000)
            avg = sum(times) / len(times)
            print(f"{name:<55} | Avg: {avg:6.2f}ms | Min: {min(times):6.2f}ms | Max: {max(times):6.2f}ms")

        print("Endpoint                                               | Latency")
        print("--------------------------------------------------------------------------------")
        await measure("Browse offset=0 limit=40", "/api/catalog/movies?limit=40&offset=0")
        await measure("Browse offset=1000 limit=40", "/api/catalog/movies?limit=40&offset=1000")
        await measure("Browse offset=50000 limit=40 (Deep Offset)", "/api/catalog/movies?limit=40&offset=50000")
        await measure("Browse Keyset Cursor (Deep Cursor)", "/api/catalog/movies?cursor=Frozen%20Horizon%202__00000000-0000-0000-0000-000000000000&limit=40")
        await measure("Search prefix (q=Dark)", "/api/catalog/search?q=Dark&limit=40&offset=0")
        await measure("Search substring (q=Protocol)", "/api/catalog/search?q=Protocol&limit=40&offset=0")
        await measure("Search common (q=Empire)", "/api/catalog/search?q=Empire&limit=40&offset=0")
        await measure("Search rare (q=Specter)", "/api/catalog/search?q=Specter&limit=40&offset=0")
        await measure("Search no-result (q=XyzNonExistentTitle99)", "/api/catalog/search?q=XyzNonExistentTitle99&limit=40&offset=0")
        await measure("Genre filter (genre=Sci-Fi)", "/api/catalog/movies?genre=Sci-Fi&limit=40&offset=0")
        await measure("Genre filter (genre=Drama)", "/api/catalog/movies?genre=Drama&limit=40&offset=0")
        await measure("Combined search+genre (q=Dark, genre=Action)", "/api/catalog/search?q=Dark&genre=Action&limit=40&offset=0")
        await measure("Sort year_desc", "/api/catalog/movies?sort_by=year_desc&limit=40&offset=0")
        await measure("Sort year_asc", "/api/catalog/movies?sort_by=year_asc&limit=40&offset=0")
        await measure("Search suggestions (q=Dar)", "/api/catalog/search/suggestions?q=Dar&limit=5")

if __name__ == "__main__":
    asyncio.run(benchmark_phase_e())
