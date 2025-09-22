# app/main.py
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# 先加载 .env
load_dotenv()

from app.api import router as api_router


app = FastAPI(title="AI Roleplay BFF (FastAPI)")

# 允许前端跨域（按需收紧）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产建议改成你的前端域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

@app.get("/")
async def root():
    return {"ok": True, "service": "ai-roleplay-backend", "docs": "/docs"}
