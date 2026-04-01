from dotenv import load_dotenv

# Load env variables first
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import router
from services.db_service import init_firebase

# Initialize external services
init_firebase()

app = FastAPI(title="InspectAI API", version="1.0.0")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for local dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

@app.get("/")
def read_root():
    return {"status": "ok", "message": "InspectAI Backend is running! Access /docs for Swagger UI"}

@app.get("/api/ping")
def ping():
    return {"status": "ok", "message": "Backend is reachable!"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
