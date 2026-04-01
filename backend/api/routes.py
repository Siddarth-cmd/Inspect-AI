from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Header
from services.ai_service import analyze_image
from services.db_service import save_inspection, get_user_history, verify_token, save_user_profile, get_user_profile
from pydantic import BaseModel
import datetime
import base64

router = APIRouter()

CARD = "bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl"

def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid or missing token")
    token = authorization.split("Bearer ")[1]
    
    # Try Firebase token verification (returns email or uid — both stable)
    uid = verify_token(token)
    if uid:
        return uid
    
    # Fallback: use a fixed guest user so history is always consistent locally
    return "local_guest"

@router.post("/predict")
async def predict(file: UploadFile = File(...), user_id: str = Depends(get_current_user)):
    try:
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Empty file")

        print(f"📷 Analyzing: {file.filename} for user: {user_id}")
        detection_results = analyze_image(contents)

        if "error" in detection_results:
            raise HTTPException(status_code=500, detail=detection_results["error"])

        record = {
            "filename": file.filename,
            "defects": detection_results.get("defects", []),
            "quality_score": detection_results.get("quality_score", 100),
            "date": datetime.datetime.now().isoformat(),
            # Store image as base64 data URL so it can be embedded in History PDFs
            "image_data": "data:image/jpeg;base64," + base64.b64encode(contents).decode("utf-8"),
        }

        doc_id = save_inspection(user_id, record)
        print(f"✅ Inspection saved as: {doc_id}")

        return detection_results

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ /predict error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
async def history(user_id: str = Depends(get_current_user)):
    try:
        records = get_user_history(user_id)
        print(f"📋 /history → {len(records)} records for {user_id}")

        # Serialize safely (handles Firestore Timestamps etc.)
        cleaned = []
        for r in records:
            clean = {}
            for k, v in r.items():
                if hasattr(v, 'isoformat'):
                    clean[k] = v.isoformat()
                elif hasattr(v, '_seconds'):   # Firestore Timestamp
                    clean[k] = datetime.datetime.fromtimestamp(v._seconds).isoformat()
                else:
                    clean[k] = v
            cleaned.append(clean)
        return cleaned

    except Exception as e:
        print(f"❌ /history error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class UserProfileRequest(BaseModel):
    full_name: str = ""
    company: str = ""
    job_title: str = ""

@router.get("/profile")
async def get_profile(user_id: str = Depends(get_current_user)):
    try:
        profile = get_user_profile(user_id)
        return {"profile": profile}
    except Exception as e:
        print(f"❌ /profile GET error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch profile")

@router.post("/profile")
async def update_profile(profile: UserProfileRequest, user_id: str = Depends(get_current_user)):
    try:
        success = save_user_profile(user_id, profile.dict())
        if not success:
            raise HTTPException(status_code=500, detail="Failed to save profile")
        return {"status": "success", "message": "Profile updated"}
    except Exception as e:
        print(f"❌ /profile POST error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update profile")

