from fastapi import APIRouter
from app.api.endpoints import auth, profiles, catalog, admin, videos, watch_history

api_router = APIRouter()

# Register sub-routers under api paths
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(profiles.router, prefix="/profiles", tags=["Profiles"])
api_router.include_router(catalog.router, prefix="/catalog", tags=["Catalog"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin Control"])
api_router.include_router(videos.router, prefix="/videos", tags=["Videos"])
api_router.include_router(watch_history.router, prefix="/watch-history", tags=["Watch History"])
