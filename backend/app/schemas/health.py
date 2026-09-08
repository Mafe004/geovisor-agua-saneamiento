from typing import Any

from pydantic import BaseModel


class RootResponse(BaseModel):
    message: str


class HealthResponse(BaseModel):
    status: str


class DbTestResponse(BaseModel):
    db: str
    result: dict[str, Any]
