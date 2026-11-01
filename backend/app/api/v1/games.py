from fastapi import APIRouter, Response
from app.services.game_discovery import games_snapshot

router = APIRouter()


@router.get("/games/discover")
async def discover_games(response: Response):
    result = await games_snapshot()
    response.headers["Cache-Control"] = "public, max-age=300"
    return result
