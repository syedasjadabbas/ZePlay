import asyncio
import asyncpg

async def verify_integrity():
    conn = await asyncpg.connect('postgresql://postgres:postgres@127.0.0.1:5432/zeplay')

    print("==================================================")
    print("PHASE O: FINAL DATA INTEGRITY VERIFICATION")
    print("==================================================")

    gen_count = await conn.fetchval("SELECT COUNT(*) FROM movies WHERE is_generated = true;")
    real_count = await conn.fetchval("SELECT COUNT(*) FROM movies WHERE is_generated = false OR is_generated IS NULL;")
    total_count = await conn.fetchval("SELECT COUNT(*) FROM movies;")

    print(f"Generated Movies: {gen_count}")
    print(f"Real Movies:      {real_count}")
    print(f"Total Movies:     {total_count}")

    assert gen_count == 100000, f"Expected 100000 generated, got {gen_count}"
    assert real_count == 17, f"Expected 17 real, got {real_count}"
    assert total_count == 100017, f"Expected 100017 total, got {total_count}"

    # Orphan movie_genres check
    orphan_genres = await conn.fetchval("""
        SELECT COUNT(*) FROM movie_genres mg 
        LEFT JOIN movies m ON mg.movie_id = m.movie_id 
        WHERE m.movie_id IS NULL;
    """)
    print(f"Orphan movie_genres entries: {orphan_genres}")
    assert orphan_genres == 0, f"Found {orphan_genres} orphan movie_genres!"

    # Real movies video relationship check
    real_movies = await conn.fetch("SELECT movie_id, title, video_url FROM movies WHERE is_generated = false;")
    print(f"\nReal Movies Verified ({len(real_movies)}):")
    for r in real_movies:
        print(f"  [{r['movie_id']}] {r['title']} -> {r['video_url']}")
        assert r['video_url'] != "generated://no-video"

    # Watch history & watchlist checks
    watch_history_count = await conn.fetchval("SELECT COUNT(*) FROM watch_history;")
    watchlist_count = await conn.fetchval("SELECT COUNT(*) FROM watchlist;")
    print(f"\nWatch History entries: {watch_history_count}")
    print(f"Watchlist entries:     {watchlist_count}")

    await conn.close()
    print("\n[OK] DATA INTEGRITY VERIFICATION PASSED PERFECTLY!")

if __name__ == "__main__":
    asyncio.run(verify_integrity())
