import asyncio
import uuid
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select, delete
from app.config import settings
from app.models.genre import Genre
from app.models.movie import Movie
from app.models.user import User
from app.models.subscription_plan import SubscriptionPlan
from app.core import security

FREE_PLAN_ID = uuid.UUID("f0000000-0000-0000-0000-000000000001")
PREMIUM_PLAN_ID = uuid.UUID("f0000000-0000-0000-0000-000000000002")

async def seed_data():
    engine = create_async_engine(settings.DATABASE_URL)
    Session = async_sessionmaker(bind=engine, expire_on_commit=False)
    
    async with Session() as db:
        # Seed default subscription plans
        for p_id, name, desc, max_p, s_4k, s_md in [
            (FREE_PLAN_ID, "free", "Standard streaming with 1 profile.", 1, False, False),
            (PREMIUM_PLAN_ID, "premium", "Premium badge, up to 4 profiles, 4K and multi-device ready.", 4, True, True)
        ]:
            res = await db.execute(select(SubscriptionPlan).filter(SubscriptionPlan.id == p_id))
            existing_plan = res.scalars().first()
            if not existing_plan:
                plan = SubscriptionPlan(
                    id=p_id,
                    name=name,
                    description=desc,
                    max_profiles=max_p,
                    supports_4k=s_4k,
                    supports_multi_device=s_md
                )
                db.add(plan)
                print(f"Seeded plan: {name}")
        await db.commit()

        # Seed Admin User
        admin_email = "admin@zeplay.com"
        result = await db.execute(select(User).filter(User.email == admin_email))
        admin_user = result.scalars().first()
        if not admin_user:
            admin_user = User(
                email=admin_email,
                name="ZePlay Admin",
                password_hash=security.get_password_hash("admin123"),
                subscription_plan="premium",
                is_verified=True,
                is_admin=True
            )
            db.add(admin_user)
            print(f"Seeded admin user: {admin_email}")
        else:
            admin_user.is_admin = True
            admin_user.is_verified = True
            admin_user.password_hash = security.get_password_hash("admin123")
            print(f"Updated existing admin user: {admin_email}")
        
        await db.commit()

        # Clear existing movies and genres to start fresh
        await db.execute(delete(Movie))
        await db.execute(delete(Genre))
        await db.commit()

        # Seed Genres
        genres_to_seed = ["Action", "Sci-Fi", "Drama", "Thriller", "Adventure", "Comedy", "Horror", "Documentary"]
        genre_instances = {}
        for g_name in genres_to_seed:
            result = await db.execute(select(Genre).filter(Genre.name == g_name))
            existing = result.scalars().first()
            if not existing:
                existing = Genre(name=g_name)
                db.add(existing)
            genre_instances[g_name] = existing
        
        await db.commit()
        for g in genre_instances.values():
            await db.refresh(g)
            
        # Seed Movies from the reference mockup screenshot
        movies_to_seed = [
            {
                "title": "Interstellar",
                "description": "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.",
                "release_year": 2014,
                "duration_minutes": 169,
                "thumbnail_url": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80",
                "video_url": "http://example.com/videos/interstellar.m3u8",
                "genres_list": ["Sci-Fi", "Adventure"]
            },
            {
                "title": "Dune",
                "description": "Paul Atreides, a brilliant and gifted young man born into a great destiny beyond his understanding, must travel to the most dangerous planet in the universe.",
                "release_year": 2021,
                "duration_minutes": 155,
                "thumbnail_url": "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=800&auto=format&fit=crop&q=80",
                "video_url": "http://example.com/videos/dune.m3u8",
                "genres_list": ["Sci-Fi", "Adventure"]
            },
            {
                "title": "The Batman",
                "description": "Batman ventures into Gotham City's underworld when a sadistic killer leaves behind a trail of cryptic clues.",
                "release_year": 2022,
                "duration_minutes": 176,
                "thumbnail_url": "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop&q=80",
                "video_url": "http://example.com/videos/batman.m3u8",
                "genres_list": ["Action", "Drama", "Thriller"]
            },
            {
                "title": "John Wick",
                "description": "An ex-hit-man comes out of retirement to track down the gangsters that killed his dog and took everything from him.",
                "release_year": 2014,
                "duration_minutes": 101,
                "thumbnail_url": "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop&q=80",
                "video_url": "http://example.com/videos/john_wick.m3u8",
                "genres_list": ["Action", "Thriller"]
            },
            {
                "title": "Tenet",
                "description": "Armed with only one word, Tenet, and fighting for the survival of the entire world, a Protagonist journeys through a twilight world of international espionage.",
                "release_year": 2020,
                "duration_minutes": 150,
                "thumbnail_url": "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80",
                "video_url": "http://example.com/videos/tenet.m3u8",
                "genres_list": ["Sci-Fi", "Action", "Thriller"]
            },
            {
                "title": "Avatar",
                "description": "A paraplegic Marine dispatched to the moon Pandora on a unique mission becomes torn between following his orders and protecting the world he feels is his home.",
                "release_year": 2009,
                "duration_minutes": 162,
                "thumbnail_url": "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=800&auto=format&fit=crop&q=80",
                "video_url": "http://example.com/videos/avatar.m3u8",
                "genres_list": ["Sci-Fi", "Adventure", "Action"]
            },
            {
                "title": "Oppenheimer",
                "description": "The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.",
                "release_year": 2023,
                "duration_minutes": 180,
                "thumbnail_url": "https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=800&auto=format&fit=crop&q=80",
                "video_url": "http://example.com/videos/oppenheimer.m3u8",
                "genres_list": ["Drama", "Documentary"]
            },
            {
                "title": "The Dark Knight",
                "description": "When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.",
                "release_year": 2008,
                "duration_minutes": 152,
                "thumbnail_url": "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=800&auto=format&fit=crop&q=80",
                "video_url": "http://example.com/videos/dark_knight.m3u8",
                "genres_list": ["Action", "Drama", "Thriller"]
            },
            {
                "title": "Inception",
                "description": "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.",
                "release_year": 2010,
                "duration_minutes": 148,
                "thumbnail_url": "https://images.unsplash.com/photo-1542204172-e7052809f852?w=800&auto=format&fit=crop&q=80",
                "video_url": "http://example.com/videos/inception.m3u8",
                "genres_list": ["Sci-Fi", "Action", "Thriller"]
            },
            {
                "title": "The Martian",
                "description": "An astronaut becomes stranded on Mars after his crew assume him dead, and must rely on his ingenuity to find a way to signal to Earth that he is alive.",
                "release_year": 2015,
                "duration_minutes": 144,
                "thumbnail_url": "https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=800&auto=format&fit=crop&q=80",
                "video_url": "http://example.com/videos/martian.m3u8",
                "genres_list": ["Sci-Fi", "Adventure", "Drama"]
            },
            {
                "title": "The Expanse",
                "description": "A police detective in the asteroid belt, the first officer of an ice-miner, and an United Nations executive-associate slowly discover a vast conspiracy.",
                "release_year": 2015,
                "duration_minutes": 60,
                "thumbnail_url": "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=800&auto=format&fit=crop&q=80",
                "video_url": "http://example.com/videos/expanse.m3u8",
                "genres_list": ["Sci-Fi", "Drama"]
            },
            {
                "title": "Stranger Things",
                "description": "When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces and one strange little girl.",
                "release_year": 2016,
                "duration_minutes": 50,
                "thumbnail_url": "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop&q=80",
                "video_url": "http://example.com/videos/stranger_things.m3u8",
                "genres_list": ["Sci-Fi", "Drama", "Thriller"]
            },
            {
                "title": "The Witcher",
                "description": "Geralt of Rivia, a solitary monster hunter, struggles to find his place in a world where people often prove more wicked than beasts.",
                "release_year": 2019,
                "duration_minutes": 60,
                "thumbnail_url": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80",
                "video_url": "http://example.com/videos/witcher.m3u8",
                "genres_list": ["Action", "Adventure", "Drama"]
            },
            {
                "title": "Mindhunter",
                "description": "In the late 1970s two FBI agents expand criminal science by delving into the psychology of murder and getting uneasily close to all-too-real monsters.",
                "release_year": 2017,
                "duration_minutes": 60,
                "thumbnail_url": "https://images.unsplash.com/photo-1501504905252-473c47e087f8?w=800&auto=format&fit=crop&q=80",
                "video_url": "http://example.com/videos/mindhunter.m3u8",
                "genres_list": ["Drama", "Thriller"]
            }
        ]
        
        for m_data in movies_to_seed:
            movie_genres_list = [genre_instances[name] for name in m_data["genres_list"]]
            movie = Movie(
                title=m_data["title"],
                description=m_data["description"],
                release_year=m_data["release_year"],
                duration_minutes=m_data["duration_minutes"],
                thumbnail_url=m_data["thumbnail_url"],
                video_url=m_data["video_url"],
                genres=movie_genres_list
            )
            db.add(movie)
        
        await db.commit()
        print("Database successfully seeded with reference movies and genres!")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(seed_data())
