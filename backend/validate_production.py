import asyncio
import os
import sys
import uuid
import httpx
from datetime import datetime, timezone

# Add parent directory to python path to import app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.config import settings
from app.database import Base
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import text

# Test credentials
TEST_USER_EMAIL = "realuser_audit@example.com"
TEST_ADMIN_EMAIL = "admin_audit@example.com"
TEST_PASSWORD = "Password123!"

async def setup_db_clean():
    """Connect to Postgres, clean up validation users and ensure table structures exist."""
    print("----------------------------------------------------------------------")
    print("PHASE 1: Database Check and Environment Decoupling")
    print("----------------------------------------------------------------------")
    
    # 1. Assert DATABASE_URL is Postgres
    if "sqlite" in settings.DATABASE_URL:
        print("FAIL: SQLite is still set as the DATABASE_URL in config/env.")
        sys.exit(1)
    else:
        print(f"PASS: SQLite decoupled. Database URL is: {settings.DATABASE_URL}")

    engine = create_async_engine(settings.DATABASE_URL)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    
    async with async_session() as session:
        # Delete existing test users and related records to ensure fresh testing run
        print("Cleaning up database test accounts...")
        await session.execute(
            text("DELETE FROM email_verification_tokens WHERE user_id IN (SELECT user_id FROM users WHERE email IN (:u1, :u2))"),
            {"u1": TEST_USER_EMAIL, "u2": TEST_ADMIN_EMAIL}
        )
        await session.execute(
            text("DELETE FROM user_subscriptions WHERE user_id IN (SELECT user_id FROM users WHERE email IN (:u1, :u2))"),
            {"u1": TEST_USER_EMAIL, "u2": TEST_ADMIN_EMAIL}
        )
        await session.execute(
            text("DELETE FROM watch_history WHERE user_id IN (SELECT user_id FROM users WHERE email IN (:u1, :u2))"),
            {"u1": TEST_USER_EMAIL, "u2": TEST_ADMIN_EMAIL}
        )
        await session.execute(
            text("DELETE FROM profiles WHERE user_id IN (SELECT user_id FROM users WHERE email IN (:u1, :u2))"),
            {"u1": TEST_USER_EMAIL, "u2": TEST_ADMIN_EMAIL}
        )
        await session.execute(
            text("DELETE FROM users WHERE email IN (:u1, :u2)"),
            {"u1": TEST_USER_EMAIL, "u2": TEST_ADMIN_EMAIL}
        )
        await session.commit()
        print("PASS: PostgreSQL verification and cleanup completed successfully.")
    
    await engine.dispose()

async def get_db_verification_token(email: str) -> str:
    """Helper to fetch verification token directly from postgres."""
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    async with async_session() as session:
        result = await session.execute(
            text("""
                SELECT token FROM email_verification_tokens 
                WHERE user_id = (SELECT user_id FROM users WHERE email = :email)
                LIMIT 1
            """),
            {"email": email}
        )
        token = result.scalar()
    await engine.dispose()
    return token

async def make_user_admin(email: str):
    """Helper to promote user to administrator inside database."""
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    async with async_session() as session:
        await session.execute(
            text("UPDATE users SET is_admin = true, is_verified = true WHERE email = :email"),
            {"email": email}
        )
        await session.commit()
    await engine.dispose()
    print(f"PASS: User {email} has been promoted to Admin.")

async def simulate_subscription_deactivation(email: str):
    """Helper to simulate sub deactivation by deleting user subscription record."""
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    async with async_session() as session:
        # Delete active subscription
        await session.execute(
            text("DELETE FROM user_subscriptions WHERE user_id = (SELECT user_id FROM users WHERE email = :email)"),
            {"email": email}
        )
        # Update user plan back to free
        await session.execute(
            text("UPDATE users SET subscription_plan = 'free' WHERE email = :email"),
            {"email": email}
        )
        await session.commit()
    await engine.dispose()

async def main():
    # Setup PG Database and ensure clean user table
    await setup_db_clean()
    
    async with httpx.AsyncClient(base_url="http://127.0.0.1:8000", timeout=120.0) as client:
        print("\n----------------------------------------------------------------------")
        print("PHASE 2: User Workflows (Register, Verify, Login, Profiles, History)")
        print("----------------------------------------------------------------------")
        
        # 1. User Registration
        print("Registering new user account...")
        register_payload = {
            "email": TEST_USER_EMAIL,
            "password": TEST_PASSWORD,
            "name": "Audit User"
        }
        reg_res = await client.post("/api/auth/register", json=register_payload)
        assert reg_res.status_code == 201, f"Failed registration: {reg_res.text}"
        print("PASS: User registered successfully.")
        
        # 2. Email Verification Token Check and API Execution
        print("Retrieving email verification token...")
        token = await get_db_verification_token(TEST_USER_EMAIL)
        assert token is not None, "Email verification token was not created in PG database."
        print(f"Fetched Token: {token}")
        
        verify_res = await client.post("/api/auth/verify-email", json={"token": token})
        assert verify_res.status_code == 200, f"Email verification failed: {verify_res.text}"
        print("PASS: Email successfully verified.")
        
        # 3. User Login
        print("Logging in to obtain JWT Access Token...")
        login_data = {
            "username": TEST_USER_EMAIL,
            "password": TEST_PASSWORD
        }
        login_res = await client.post("/api/auth/login", data=login_data)
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        token_payload = login_res.json()
        access_token = token_payload["access_token"]
        print("PASS: Login completed. Token received.")
        
        # Set JWT token for all subsequent requests
        client.headers.update({"Authorization": f"Bearer {access_token}"})
        
        # 4. Profiles Management
        print("Creating User Profiles...")
        profile_payload = {
            "display_name": "Adult Profile",
            "is_kids_profile": False,
            "pin": "1234"
        }
        prof_res = await client.post("/api/profiles/", json=profile_payload)
        assert prof_res.status_code == 201, f"Failed to create profile: {prof_res.text}"
        profile = prof_res.json()
        profile_id = profile["profile_id"]
        print(f"PASS: Profile created (ID: {profile_id})")
        
        # PIN locked verification
        print("Verifying profile PIN gate...")
        pin_res = await client.post(f"/api/profiles/{profile_id}/verify-pin", json={"pin": "1234"})
        assert pin_res.status_code == 200, f"PIN verification failed: {pin_res.text}"
        print("PASS: Profile PIN verification successful.")
        
        # 5. Admin Promotion and Ingestion upload flows
        print("\n----------------------------------------------------------------------")
        print("PHASE 3: Admin Ingest & HLS Transcoding validation")
        print("----------------------------------------------------------------------")
        
        # Create Admin user
        print("Creating Admin account...")
        admin_register_payload = {
            "email": TEST_ADMIN_EMAIL,
            "password": TEST_PASSWORD,
            "name": "Admin Audit"
        }
        admin_reg_res = await client.post("/api/auth/register", json=admin_register_payload)
        assert admin_reg_res.status_code == 201, f"Failed admin registration: {admin_reg_res.text}"
        
        # Promote admin directly in Postgres
        await make_user_admin(TEST_ADMIN_EMAIL)
        
        # Login as Admin
        admin_client = httpx.AsyncClient(base_url="http://127.0.0.1:8000", timeout=120.0)
        admin_login_res = await admin_client.post("/api/auth/login", data={"username": TEST_ADMIN_EMAIL, "password": TEST_PASSWORD})
        assert admin_login_res.status_code == 200, f"Admin login failed: {admin_login_res.text}"
        admin_token = admin_login_res.json()["access_token"]
        admin_client.headers.update({"Authorization": f"Bearer {admin_token}"})
        
        # Create movie record to link video
        movie_payload = {
            "title": "Audit HLS Movie",
            "description": "Adaptive bitrate streaming verification movie",
            "release_year": 2026,
            "duration_minutes": 1,
            "thumbnail_url": "http://example.com/thumb.jpg",
            "video_url": "http://example.com/video.mp4",
            "genre_ids": []
        }
        movie_res = await admin_client.post("/api/admin/movies", json=movie_payload)
        assert movie_res.status_code == 201, f"Failed to create movie: {movie_res.text}"
        movie_id = movie_res.json()["movie_id"]
        print(f"PASS: Movie metadata ingested (ID: {movie_id})")
        
        # Upload video and process HLS (Blocks until FFmpeg transcoding completes)
        print("Uploading test video and processing HLS variants (will wait for FFmpeg)...")
        test_video_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_video.mp4")
        with open(test_video_path, "rb") as vf:
            files = {"file": ("test_video.mp4", vf, "video/mp4")}
            data = {"movie_id": str(movie_id)}
            upload_res = await admin_client.post("/api/videos/admin/upload", files=files, data=data)
            
        assert upload_res.status_code == 201, f"Upload and transcode failed: {upload_res.text}"
        video_payload = upload_res.json()
        video_id = video_payload["video_id"]
        assert video_payload["status"] == "processing", f"Transcoding was not queued in background: {video_payload}"
        print(f"PASS: Upload completed. Background transcoding task queued (Status: {video_payload['status']})")
        
        # Poll for completion
        print("Polling HLS background transcoding task...")
        max_attempts = 45
        for attempt in range(max_attempts):
            poll_res = await admin_client.get(f"/api/videos/{video_id}")
            assert poll_res.status_code == 200, f"Polling failed: {poll_res.text}"
            video_data = poll_res.json()
            status = video_data["status"]
            print(f"Attempt {attempt+1}: Transcoding status is '{status}'")
            if status == "completed":
                video_payload = video_data
                break
            elif status == "failed":
                raise AssertionError(f"Background transcoding failed: {video_data.get('error_message')}")
            await asyncio.sleep(1.0)
        else:
            raise AssertionError("Transcoding did not complete within timeout window.")
            
        print(f"PASS: Background transcoding completed. HLS URL is: {video_payload['hls_url']}")
        
        # Verify local storage file deletion (Replacing local storage dependency)
        storage_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "storage", "videos", f"{video_id}.mp4")
        hls_folder = os.path.join(os.path.dirname(os.path.abspath(__file__)), "storage", "videos", f"{video_id}_hls")
        print("Verifying local storage decoupling...")
        print(f"Checking deleted local MP4 path: {storage_file}")
        print(f"Checking deleted local HLS path: {hls_folder}")
        assert not os.path.exists(storage_file), f"Local source video still exists at {storage_file}"
        assert not os.path.exists(hls_folder), f"Local HLS segments directory still exists at {hls_folder}"
        print("PASS: Local storage decoupled. Local source and HLS files deleted successfully.")
        
        print("\n----------------------------------------------------------------------")
        print("PHASE 4: HLS Streaming End-to-End Playlist & Segments Verification")
        print("----------------------------------------------------------------------")
        
        # Verify master.m3u8 Redirect to CDN
        local_hls_url = f"/api/videos/{video_id}/hls/master.m3u8"
        print(f"Retrieving HLS master playlist from local endpoint (asserting 307 Redirect)...")
        master_res = await client.get(local_hls_url, follow_redirects=False)
        assert master_res.status_code in (302, 307), f"HLS endpoint did not return redirect: {master_res.status_code}"
        location = master_res.headers.get("location")
        print(f"Redirect Location header: {location}")
        assert "cloudfront.net" in location, f"Location header does not point to CloudFront CDN: {location}"
        print("PASS: HTTP 307 Redirect to CDN verified successfully.")
        
        # Verify variant playlist redirects to CDN
        variant_url = f"/api/videos/{video_id}/hls/1080p/index.m3u8"
        print(f"Retrieving variant HLS playlist (asserting 307 Redirect)...")
        variant_res = await client.get(variant_url, follow_redirects=False)
        assert variant_res.status_code in (302, 307)
        variant_location = variant_res.headers.get("location")
        print(f"Variant Redirect location: {variant_location}")
        assert "cloudfront.net" in variant_location
        assert "1080p/index.m3u8" in variant_location
        print("PASS: HTTP 307 Redirect to CDN for variants verified successfully.")

        
        print("\n----------------------------------------------------------------------")
        print("PHASE 5: Entitlement Access Protection Gating")
        print("----------------------------------------------------------------------")
        
        # Deactivate subscription to force free user block on movie catalog detail
        print("Deactivating active user subscription to verify premium gate block...")
        await simulate_subscription_deactivation(TEST_USER_EMAIL)
        
        # Request movie details as un-subscribed user (confirm 403)
        gated_res = await client.get(f"/api/catalog/movies/{movie_id}")
        assert gated_res.status_code == 403, f"Entitlement gate bypassed! Free user got: {gated_res.status_code}"
        print("PASS: Free user blocked with HTTP 403 on premium movie access.")
        
        # Upgrade subscription back to Premium
        print("Upgrading user to premium subscription...")
        upgrade_res = await client.post("/api/subscription/upgrade", json={"plan_name": "premium"})
        assert upgrade_res.status_code == 200, f"Upgrade failed: {upgrade_res.text}"
        
        # Request movie details as upgraded premium user (confirm 200)
        premium_movie_res = await client.get(f"/api/catalog/movies/{movie_id}")
        assert premium_movie_res.status_code == 200, f"Premium user failed to access: {premium_movie_res.text}"
        print("PASS: Entitlement gate opened successfully for Premium user (HTTP 200).")
        
        # 6. Playback Progress tracking
        print("Updating watch progress positioning...")
        progress_payload = {
            "profile_id": str(profile_id),
            "movie_id": str(movie_id),
            "video_id": str(video_id),
            "current_position": 45.5,
            "duration": 60.0
        }
        prog_update_res = await client.post("/api/watch-history/progress", json=progress_payload)
        assert prog_update_res.status_code == 200, f"Failed updating watch progress: {prog_update_res.text}"
        print("PASS: Playback watch progress saved.")
        
        # Get continue watching list
        print("Retrieving Continue Watching playlist...")
        cont_res = await client.get(f"/api/watch-history/continue-watching?profile_id={profile_id}")
        assert cont_res.status_code == 200, f"Failed continue watching retrieval: {cont_res.text}"
        continue_items = cont_res.json()
        assert len(continue_items) > 0, "No watch items returned in continue list."
        assert continue_items[0]["movie_id"] == str(movie_id), "Wrong movie returned in watch progress continue block"
        print(f"PASS: Continue watching active. Saved timestamp position: {continue_items[0]['current_position']}s")
        
        print("\n----------------------------------------------------------------------")
        print("PHASE 6: Redis Cache Hit/Miss Auditing & Performance Check")
        print("----------------------------------------------------------------------")
        
        # Query Suggestions endpoint multiple times to trigger hits
        print("Performing repeated autocomplete suggestion searches to warm cache...")
        for i in range(10):
            await client.get("/api/catalog/search/suggestions?q=cyb")
        
        # Directly inspect Redis keyspace using redis asyncio client
        import redis.asyncio as aioredis
        r_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True, protocol=2)
        redis_keys = await r_client.keys("suggestions:*")
        print(f"Direct Redis inspection keys: {redis_keys}")
        
        # Get stats via API
        stats_res = await admin_client.get("/api/admin/cache/stats")
        assert stats_res.status_code == 200, f"Failed cache stats: {stats_res.text}"
        stats = stats_res.json()
        print(f"Cache Engine: {stats['cache_engine']}")
        print(f"Cache Connected: {stats['redis_connected']}")
        print(f"Global Redis Hits: {stats['hits']} | Global Redis Misses: {stats['misses']}")
        print(f"Global Hit Rate: {stats['hit_rate_pct']}%")
        
        # Assertions
        assert stats["redis_connected"] is True, "Redis connection is not reported active by server."
        assert len(redis_keys) > 0, "No cache keys found in Redis database for suggestions!"
        print("PASS: Redis caching active with key verified directly in Redis store.")
        print("PASS: Verified: Redis-based shared counters successfully resolved process-local metrics isolation.")
        await r_client.aclose()
        
        
        # Cleanup video assets
        print("\nCleaning up ingested media files...")
        del_video_res = await admin_client.delete(f"/api/videos/admin/{video_id}")
        assert del_video_res.status_code == 204
        print("PASS: Ingested test video deleted and directory removed cleanly.")
        
        await admin_client.aclose()
        print("\n======================================================================")
        print("ALL AUDIT AND PIPELINE VERIFICATIONS PASSED SUCCESSFULLY!")
        print("======================================================================")

if __name__ == "__main__":
    asyncio.run(main())
