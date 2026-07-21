from fastapi import APIRouter
from app.api.endpoints import auth, profiles, catalog, admin

api_router = APIRouter()

# Register sub-routers under api paths
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(profiles.router, prefix="/profiles", tags=["Profiles"])
api_router.include_router(catalog.router, prefix="/catalog", tags=["Catalog"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin Control"])
