import uuid
from pydantic import BaseModel, Field, ConfigDict

class GenreBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)

class GenreCreate(GenreBase):
    pass

class GenreResponse(GenreBase):
    genre_id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)
