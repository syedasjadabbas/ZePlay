import asyncpg
import asyncio
import time
import httpx

async def benchmark():
    conn = await asyncpg.connect('postgresql://postgres:postgres@127.0.0.1:5432/zeplay')
    total = await conn.fetchval('SELECT COUNT(*) FROM movies;')
    real = await conn.fetchval('SELECT COUNT(*) FROM movies WHERE is_generated = false;')
    gen = await conn.fetchval('SELECT COUNT(*) FROM movies WHERE is_generated = true;')
    db_size = await conn.fetchval("SELECT pg_size_pretty(pg_database_size('zeplay'));")
    print(f"--- PHASE A BASELINE AT 1,000 GENERATED RECORDS ---")
    print(f"Total Movies:     {total}")
    print(f"Real Movies:      {real}")
    print(f"Generated Movies: {gen}")
    print(f"Database Size:    {db_size}")
    await conn.close()

    async with httpx.AsyncClient(base_url='http://127.0.0.1:8000') as client:
        # Register/login user for token
        await client.post('/api/auth/register', json={'email': 'bench@example.com', 'name': 'Bench User', 'password': 'Password123!'})
        login = await client.post('/api/auth/login', data={'username': 'bench@example.com', 'password': 'Password123!'})
        token = login.json().get('access_token', '')
        headers = {'Authorization': f'Bearer {token}'} if token else {}

        async def measure(name, url):
            times = []
            for _ in range(5):
                t0 = time.monotonic()
                r = await client.get(url, headers=headers)
                t1 = time.monotonic()
                times.append((t1 - t0) * 1000)
            avg = sum(times) / len(times)
            print(f"{name}: {avg:.2f}ms (min: {min(times):.2f}ms, max: {max(times):.2f}ms)")

        await measure("1. First Browse Page (limit=40, offset=0)", "/api/catalog/movies?limit=40&offset=0")
        await measure("2. Later Browse Page (limit=40, offset=500)", "/api/catalog/movies?limit=40&offset=500")
        await measure("3. Title Search (q=Dark)", "/api/catalog/search?q=Dark&limit=40&offset=0")
        await measure("4. Genre Filter (genre=Action)", "/api/catalog/movies?genre=Action&limit=40&offset=0")
        await measure("5. Combined Search+Genre (q=Dark, genre=Action)", "/api/catalog/search?q=Dark&genre=Action&limit=40&offset=0")

if __name__ == "__main__":
    asyncio.run(benchmark())
