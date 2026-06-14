from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import chat, models
from app.config import get_settings
from app.core.exceptions import register_exception_handlers


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(title="BYOK Chat Backend", 
            version="0.1.0", 
            docs_url=None, 
            redoc_url = None
        )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)

    app.include_router(chat.router, prefix="/chat", tags=["chat"])
    app.include_router(models.router, prefix="/models", tags=["models"])

    return app


app = create_app()
