"""
ZePlay Catalog Scale Testing Seeder — Stage 1
Seeds exactly 1,000 generated catalog test movies.

Usage:
  python seed_catalog.py              # Seed 1,000 movies (idempotent)
  python seed_catalog.py --cleanup    # Remove generated records only (is_generated=True)
  python seed_catalog.py --count      # Print current counts and exit

Safety:
  - Never deletes real movies (is_generated=False)
  - Idempotent: running twice keeps exactly 1,000 generated records
  - Bulk insertion in batches (no per-row ORM transactions)
  - Deterministic: random.seed(42) ensures reproducibility
"""

import sys
import asyncio
import uuid
import random
import time
from datetime import datetime, timezone

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

# Load settings
import os
sys.path.insert(0, os.path.dirname(__file__))
from app.config import settings
from app.models.genre import movie_genres  # association table

TARGET_COUNT = 1_000
BATCH_SIZE = 250

# ---------------------------------------------------------------------------
# Deterministic content generation data
# ---------------------------------------------------------------------------
random.seed(42)

TITLE_ADJECTIVES = [
    "Dark", "Silent", "Lost", "Broken", "Hidden", "Fallen", "Rising", "Final",
    "Secret", "Frozen", "Burning", "Hollow", "Ancient", "Shattered", "Golden",
    "Neon", "Iron", "Crystal", "Infinite", "Crimson", "Midnight", "Electric",
    "Phantom", "Echoing", "Savage", "Raging", "Fleeting", "Distant", "Digital",
    "Quantum", "Synthetic", "Turbulent", "Vanishing", "Sovereign", "Parallel",
]

TITLE_NOUNS = [
    "Empire", "Horizon", "Protocol", "Signal", "Echo", "Storm", "Nexus",
    "Reckoning", "Legacy", "Genesis", "Remnant", "Circuit", "Threshold",
    "Dominion", "Void", "Pulse", "Cipher", "Command", "Vector", "Paradox",
    "Sequence", "Frontier", "Manifesto", "Descent", "Uprising", "Breach",
    "Passage", "Archive", "Meridian", "Covenant", "Specter", "Overture",
    "Summit", "Labyrinth", "Cascade", "Interval", "Witness", "Sovereign",
    "Convergence", "Fracture", "Chronicle", "Vortex", "Sentinel", "Catalyst",
    "Epoch", "Gravity", "Interface", "Mandate", "Orbit", "Requiem",
]

TITLE_SUFFIXES = [
    "", "", "", "",  # Most titles have no suffix
    "Part I", "Part II", "Part III", "Reloaded", "Reborn", "Origins",
    "Returns", "Final Chapter", "Resurrection", "Legacy",
]

DESCRIPTIONS = [
    "When a disgraced {role} uncovers a {threat} hidden for decades, they must choose between survival and justice.",
    "In a world fractured by {conflict}, one {role} holds the key to restoring balance — if they can survive long enough.",
    "A brilliant {role} discovers that the {threat} they have been hunting was never what it seemed.",
    "As a deadly {threat} spreads across the continent, a reluctant {role} is forced out of exile to face the impossible.",
    "After losing everything, a former {role} embarks on a dangerous mission deep into enemy territory.",
    "An unlikely alliance between a {role} and a fugitive may be the only hope against an unstoppable {threat}.",
    "With only 48 hours before catastrophic failure, a lone {role} must navigate a labyrinth of betrayal and deception.",
    "Two rival {role}s are forced to work together when a catastrophic {threat} erases the boundaries between them.",
    "The {role} who swore never to return finds themselves pulled back in by a {threat} only they can understand.",
    "When the {threat} breaks through the last line of defense, one {role} stands between chaos and civilisation.",
    "A family torn apart by a mysterious {threat} must reunite to uncover a truth buried since before their birth.",
    "In the aftermath of the {conflict}, a weary {role} searches for meaning in the wreckage of a changed world.",
    "Seven strangers connected by a shared {threat} discover that their fates were intertwined long before they met.",
    "A {role} with a troubled past is hired for one last mission — but the {threat} waiting on the other side changes everything.",
    "Trapped between competing powers, a {role} must navigate impossible choices to protect what remains of their world.",
]

ROLES = [
    "detective", "scientist", "soldier", "engineer", "pilot", "agent", "surgeon",
    "hacker", "commander", "journalist", "archaeologist", "diplomat", "captain",
    "researcher", "operative", "professor", "navigator", "architect", "strategist",
]

THREATS = [
    "conspiracy", "virus", "anomaly", "weapon", "signal", "organisation", "technology",
    "rebellion", "infiltrator", "algorithm", "prototype", "network", "catastrophe",
    "phenomenon", "adversary", "formula", "artefact", "system", "revelation",
]

CONFLICTS = [
    "the war", "the collapse", "the uprising", "the breach", "the great silence",
    "the fracture", "the occupation", "the alignment", "the isolation", "the fall",
]

GENRE_WEIGHTS = {
    "Action":      0.35,
    "Sci-Fi":      0.30,
    "Drama":       0.30,
    "Thriller":    0.28,
    "Adventure":   0.22,
    "Comedy":      0.15,
    "Horror":      0.12,
    "Documentary": 0.08,
}

# Deterministic SVG data-URI poster — lightweight, no external dependency
def make_poster_svg(movie_id_str: str, title: str) -> str:
    """
    Returns a data: URI SVG poster in movie-poster aspect ratio (400x560).
    Color is deterministically derived from movie_id prefix.
    This requires no external requests, no storage, and works in all browsers.
    """
    h = int(movie_id_str.replace("-", "")[:6], 16)
    hue = h % 360
    sat = 35 + (h // 360) % 30  # 35–65
    lit = 15 + (h // 10800) % 10  # 15–25 (dark)
    lit2 = lit + 12
    short = title[:18].replace('"', "'").replace('<', '').replace('>', '')
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="560" viewBox="0 0 400 560">'
        f'<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0%" stop-color="hsl({hue},{sat}%,{lit2}%)"/>'
        f'<stop offset="100%" stop-color="hsl({hue},{sat}%,{lit}%)"/>'
        f'</linearGradient></defs>'
        f'<rect width="400" height="560" fill="url(#g)"/>'
        f'<rect x="20" y="20" width="360" height="520" rx="6" ry="6" '
        f'fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>'
        f'<text x="200" y="260" font-family="sans-serif" font-size="52" '
        f'fill="rgba(255,255,255,0.12)" text-anchor="middle">&#9654;</text>'
        f'<text x="200" y="330" font-family="sans-serif" font-size="13" '
        f'font-weight="bold" fill="rgba(255,255,255,0.7)" text-anchor="middle">'
        f'{short}</text>'
        f'<rect x="140" y="500" width="120" height="2" rx="1" '
        f'fill="hsl({hue},70%,60%)"/>'
        f'</svg>'
    )
    import base64
    encoded = base64.b64encode(svg.encode()).decode()
    return f"data:image/svg+xml;base64,{encoded}"


def generate_title(rng: random.Random) -> str:
    """Generate a unique-ish movie title."""
    adj = rng.choice(TITLE_ADJECTIVES)
    noun = rng.choice(TITLE_NOUNS)
    suffix = rng.choice(TITLE_SUFFIXES)
    title = f"{adj} {noun}"
    if suffix:
        title = f"{title}: {suffix}"
    return title


def generate_description(rng: random.Random) -> str:
    template = rng.choice(DESCRIPTIONS)
    return template.format(
        role=rng.choice(ROLES),
        threat=rng.choice(THREATS),
        conflict=rng.choice(CONFLICTS)
    )


async def seed(target: int = TARGET_COUNT) -> dict:
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    Session = async_sessionmaker(bind=engine, expire_on_commit=False)

    async with Session() as db:
        # --- Count real movies (is_generated=False) ---
        real_count_result = await db.execute(
            sa.text("SELECT COUNT(*) FROM movies WHERE is_generated = false OR is_generated IS NULL")
        )
        real_count = real_count_result.scalar() or 0

        gen_count_result = await db.execute(
            sa.text("SELECT COUNT(*) FROM movies WHERE is_generated = true")
        )
        existing_gen = gen_count_result.scalar() or 0

        print(f"Real movies (is_generated=false): {real_count}")
        print(f"Existing generated records:       {existing_gen}")

        if existing_gen >= target:
            print(f"Already have {existing_gen} generated records. Nothing to do.")
            await engine.dispose()
            return {
                "real_count": real_count,
                "generated_before": existing_gen,
                "generated_after": existing_gen,
                "inserted": 0,
            }

        # --- Fetch genre info ---
        genres_result = await db.execute(
            sa.text("SELECT genre_id, name FROM genres")
        )
        genres_rows = genres_result.fetchall()
        if not genres_rows:
            print("ERROR: No genres found. Run the main seed.py first.")
            await engine.dispose()
            return {}

        genre_list = [(r[0], r[1]) for r in genres_rows]
        genre_name_to_id = {name: gid for gid, name in genre_list}

        # Build weighted genre selection list
        weighted_genres = []
        for gid, name in genre_list:
            weight = GENRE_WEIGHTS.get(name, 0.1)
            weighted_genres.append((gid, name, weight))

        # --- Generate records ---
        rng = random.Random(42)  # deterministic
        to_insert = target - existing_gen
        print(f"Inserting {to_insert} generated records in batches of {BATCH_SIZE}...")

        t_start = time.monotonic()
        total_inserted = 0
        now = datetime.now(timezone.utc)

        for batch_start in range(0, to_insert, BATCH_SIZE):
            batch_movies = []
            batch_assocs = []
            count = min(BATCH_SIZE, to_insert - batch_start)

            for _ in range(count):
                mid = uuid.uuid4()
                title = generate_title(rng)
                desc = generate_description(rng)
                year = rng.randint(1990, 2026)
                duration = rng.randint(72, 210)
                poster = make_poster_svg(str(mid), title)

                batch_movies.append({
                    "movie_id": mid,
                    "title": title,
                    "description": desc,
                    "release_year": year,
                    "duration_minutes": duration,
                    "thumbnail_url": poster,
                    "video_url": "generated://no-video",
                    "is_generated": True,
                    "created_at": now,
                    "updated_at": now,
                })

                # Assign 1–3 genres using weighted probability
                n_genres = rng.choices([1, 2, 3], weights=[0.3, 0.5, 0.2])[0]
                selected = rng.choices(
                    weighted_genres,
                    weights=[w for _, _, w in weighted_genres],
                    k=n_genres
                )
                seen_gids = set()
                for gid, _, _ in selected:
                    if gid not in seen_gids:
                        seen_gids.add(gid)
                        batch_assocs.append({
                            "movie_id": mid,
                            "genre_id": uuid.UUID(str(gid)) if isinstance(gid, str) else gid,
                        })

            # Bulk insert movies
            await db.execute(
                sa.text(
                    "INSERT INTO movies "
                    "(movie_id, title, description, release_year, duration_minutes, "
                    "thumbnail_url, video_url, is_generated, created_at, updated_at) "
                    "VALUES (:movie_id, :title, :description, :release_year, :duration_minutes, "
                    ":thumbnail_url, :video_url, :is_generated, :created_at, :updated_at)"
                ),
                batch_movies
            )

            # Bulk insert genre associations
            if batch_assocs:
                await db.execute(
                    sa.text(
                        "INSERT INTO movie_genres (movie_id, genre_id) "
                        "VALUES (:movie_id, :genre_id)"
                    ),
                    batch_assocs
                )

            await db.commit()
            total_inserted += count
            elapsed = time.monotonic() - t_start
            print(f"  Batch complete: {total_inserted}/{to_insert} inserted ({elapsed:.1f}s elapsed)")

        t_end = time.monotonic()
        elapsed_total = t_end - t_start

        # --- Final verification ---
        gen_after_result = await db.execute(
            sa.text("SELECT COUNT(*) FROM movies WHERE is_generated = true")
        )
        gen_after = gen_after_result.scalar() or 0

        total_result = await db.execute(sa.text("SELECT COUNT(*) FROM movies"))
        total = total_result.scalar() or 0

        print(f"\n=== Seed Complete ===")
        print(f"Real movies:            {real_count}")
        print(f"Generated before:       {existing_gen}")
        print(f"Generated after:        {gen_after}")
        print(f"Total movies:           {total}")
        print(f"Elapsed:                {elapsed_total:.2f}s")
        print(f"Rate:                   {total_inserted / elapsed_total:.0f} records/sec")

    await engine.dispose()
    return {
        "real_count": real_count,
        "generated_before": existing_gen,
        "generated_after": gen_after,
        "total": total,
        "inserted": total_inserted,
        "elapsed_seconds": round(elapsed_total, 2),
    }


async def cleanup() -> dict:
    """Remove all is_generated=True records. Never touches real movies."""
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    Session = async_sessionmaker(bind=engine, expire_on_commit=False)

    async with Session() as db:
        # Count before
        gen_count_result = await db.execute(
            sa.text("SELECT COUNT(*) FROM movies WHERE is_generated = true")
        )
        gen_before = gen_count_result.scalar() or 0
        real_count_result = await db.execute(
            sa.text("SELECT COUNT(*) FROM movies WHERE is_generated = false OR is_generated IS NULL")
        )
        real_before = real_count_result.scalar() or 0

        print(f"Before cleanup: {real_before} real + {gen_before} generated")

        if gen_before == 0:
            print("No generated records to clean up.")
            await engine.dispose()
            return {"real_count": real_before, "removed": 0}

        # Delete genre associations for generated movies first
        await db.execute(
            sa.text(
                "DELETE FROM movie_genres WHERE movie_id IN "
                "(SELECT movie_id FROM movies WHERE is_generated = true)"
            )
        )
        # Delete generated movies
        await db.execute(
            sa.text("DELETE FROM movies WHERE is_generated = true")
        )
        await db.commit()

        # Verify real movies untouched
        real_after_result = await db.execute(
            sa.text("SELECT COUNT(*) FROM movies WHERE is_generated = false OR is_generated IS NULL")
        )
        real_after = real_after_result.scalar() or 0

        print(f"Removed {gen_before} generated records.")
        print(f"Real movies after cleanup: {real_after} (was {real_before}) — must match.")
        assert real_after == real_before, "SAFETY CHECK FAILED: real movie count changed!"

    await engine.dispose()
    return {"real_count": real_after, "removed": gen_before}


async def count_only():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    Session = async_sessionmaker(bind=engine, expire_on_commit=False)
    async with Session() as db:
        gen = (await db.execute(sa.text("SELECT COUNT(*) FROM movies WHERE is_generated = true"))).scalar() or 0
        real = (await db.execute(sa.text("SELECT COUNT(*) FROM movies WHERE is_generated = false OR is_generated IS NULL"))).scalar() or 0
        total = (await db.execute(sa.text("SELECT COUNT(*) FROM movies"))).scalar() or 0
        print(f"Real movies:      {real}")
        print(f"Generated movies: {gen}")
        print(f"Total movies:     {total}")
    await engine.dispose()


if __name__ == "__main__":
    if "--cleanup" in sys.argv:
        print("=== CLEANUP MODE: removing generated records only ===")
        asyncio.run(cleanup())
    elif "--count" in sys.argv:
        asyncio.run(count_only())
    else:
        print(f"=== SEED MODE: targeting {TARGET_COUNT} generated records ===")
        asyncio.run(seed(TARGET_COUNT))
