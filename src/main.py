import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from src.api.website import router as website_router
from src.api.staff import router as staff_router
from src.deps import _order_repo
from src.logging_config import setup as setup_logging

setup_logging()

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await _order_repo.close()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/payment/qr/{request_id}")
async def serve_payment_qr(request_id: str):
    safe_name = os.path.basename(request_id)
    safe_path = os.path.realpath(os.path.join("static/qr", f"{safe_name}.png"))
    if not safe_path.startswith(os.path.realpath("static/qr") + os.sep):
        return JSONResponse({"error": "not found"}, 404)
    if not os.path.isfile(safe_path):
        return JSONResponse({"error": "not found"}, 404)
    return FileResponse(safe_path, media_type="image/png")


app.include_router(website_router)
app.include_router(staff_router)
