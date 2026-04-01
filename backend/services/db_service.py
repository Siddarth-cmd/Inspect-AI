import os
import sqlite3
import json
import uuid
import firebase_admin
from firebase_admin import credentials, firestore, auth
from datetime import datetime
from pathlib import Path

db = None  # Firestore client (optional)
SQLITE_PATH = str(Path(__file__).parent.parent / "inspections.db")

# ─── Detect Environment ───────────────────────────────────────────────────────

def _is_production():
    """True when running on a cloud server (Render/Railway) with Firestore configured."""
    return bool(
        os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON") or
        (os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH") and
         os.path.exists(os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")))
    )

# ─── SQLite Setup (local dev fallback) ───────────────────────────────────────

def _get_conn():
    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def _init_sqlite():
    conn = _get_conn()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS inspections (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            filename TEXT,
            quality_score INTEGER,
            defects TEXT,
            date TEXT,
            image_data TEXT
        )
    """)
    # Upgrade older databases that don't have image_data column yet
    try:
        conn.execute("ALTER TABLE inspections ADD COLUMN image_data TEXT")
    except Exception:
        pass  # Column already exists
    conn.execute("""
        CREATE TABLE IF NOT EXISTS profiles (
            user_id TEXT PRIMARY KEY,
            full_name TEXT,
            company TEXT,
            job_title TEXT,
            updated_at TEXT
        )
    """)
    conn.commit()
    conn.close()
    print(f"[OK] SQLite database ready at: {SQLITE_PATH}")

# ─── Firebase Init ───────────────────────────────────────────────────────────

def init_firebase():
    global db

    # Try to load credentials from environment JSON string (production on Render)
    cred_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")

    try:
        if cred_json:
            # Cloud deployment: credentials stored as JSON string env var
            cred_dict = json.loads(cred_json)
            cred = credentials.Certificate(cred_dict)
            if not firebase_admin._apps:
                firebase_admin.initialize_app(cred)
            db = firestore.client()
            print("✅ Firebase Firestore initialised from environment JSON (production mode).")
        elif cred_path and os.path.exists(cred_path):
            # Local dev: credentials stored as a file
            cred = credentials.Certificate(cred_path)
            if not firebase_admin._apps:
                firebase_admin.initialize_app(cred)
            db = firestore.client()
            print("✅ Firebase Firestore initialised from service account file (local mode).")
        else:
            print("ℹ️  Firestore not configured — using SQLite as primary database.")
    except Exception as e:
        print(f"⚠️  Firestore init failed: {e} — falling back to SQLite.")

    # Always init SQLite as a fallback / for local dev
    _init_sqlite()

# ─── Token Verification ──────────────────────────────────────────────────────

def verify_token(token: str):
    """Verify Firebase token and return a stable user identifier (email)."""
    if not firebase_admin._apps:
        return None
    try:
        decoded = auth.verify_id_token(token)
        return decoded.get('email') or decoded.get('uid')
    except Exception as e:
        print(f"Token verification skipped: {e}")
        return None

# ─── Save Inspection ─────────────────────────────────────────────────────────

def save_inspection(user_id: str, data: dict):
    """Save an inspection. Firestore is primary in production; SQLite in local dev."""
    record_id = str(uuid.uuid4())

    # 1. Use Firestore if available (production)
    if db:
        try:
            db.collection('inspections').document(record_id).set({
                **data,
                "id": record_id,
                "user_id": user_id,
                "timestamp": firestore.SERVER_TIMESTAMP,
            })
            print(f"☁️  Firestore: Saved inspection {record_id} for user {user_id}")
            return record_id
        except Exception as e:
            print(f"⚠️  Firestore save failed: {e} — falling back to SQLite.")

    # 2. Fallback to SQLite (local dev)
    try:
        conn = _get_conn()
        conn.execute(
            "INSERT INTO inspections (id, user_id, filename, quality_score, defects, date, image_data) VALUES (?,?,?,?,?,?,?)",
            (
                record_id,
                user_id,
                data.get("filename", "unknown"),
                data.get("quality_score", 100),
                json.dumps(data.get("defects", [])),
                data.get("date", datetime.now().isoformat()),
                data.get("image_data"),
            )
        )
        conn.commit()
        conn.close()
        print(f"[SQLite] Saved inspection {record_id} for user {user_id}")
        return record_id
    except Exception as e:
        print(f"[ERROR] SQLite save error: {e}")
        return None

# ─── Get History ─────────────────────────────────────────────────────────────

def get_user_history(user_id: str):
    """Retrieve inspection history. Firestore is primary in production; SQLite in local dev."""

    # 1. From Firestore if available
    if db:
        try:
            docs = (
                db.collection('inspections')
                .where('user_id', '==', user_id)
                .order_by('timestamp', direction=firestore.Query.DESCENDING)
                .stream()
            )
            records = []
            for doc in docs:
                d = doc.to_dict()
                # Parse defects from string if needed (shouldn't be, but safe)
                defects = d.get("defects", [])
                if isinstance(defects, str):
                    defects = json.loads(defects)
                records.append({
                    "id": doc.id,
                    "user_id": d.get("user_id", user_id),
                    "filename": d.get("filename", ""),
                    "quality_score": d.get("quality_score", 100),
                    "defects": defects,
                    "date": d.get("date", ""),
                    "image_data": d.get("image_data"),
                })
            print(f"☁️  Firestore: {len(records)} records for {user_id}")
            return records
        except Exception as e:
            print(f"⚠️  Firestore read failed: {e} — falling back to SQLite.")

    # 2. From SQLite fallback
    try:
        conn = _get_conn()
        rows = conn.execute(
            "SELECT * FROM inspections WHERE user_id = ? ORDER BY date DESC",
            (user_id,)
        ).fetchall()
        conn.close()

        records = []
        for row in rows:
            records.append({
                "id": row["id"],
                "user_id": row["user_id"],
                "filename": row["filename"],
                "quality_score": row["quality_score"],
                "defects": json.loads(row["defects"] or "[]"),
                "date": row["date"],
                "image_data": row["image_data"],
            })
        print(f"[SQLite] {len(records)} records for {user_id}")
        return records
    except Exception as e:
        print(f"[ERROR] SQLite read error: {e}")
        return []

# ─── User Profiles ───────────────────────────────────────────────────────────

def save_user_profile(user_id: str, data: dict):
    """Save or update a user's profile. Firestore primary, SQLite fallback."""
    now = datetime.now().isoformat()

    if db:
        try:
            db.collection('profiles').document(user_id).set({
                "full_name": data.get("full_name", ""),
                "company":   data.get("company", ""),
                "job_title": data.get("job_title", ""),
                "updated_at": now,
            })
            print(f"☁️  Firestore: Saved profile for {user_id}")
            return True
        except Exception as e:
            print(f"⚠️  Firestore profile save failed: {e}")

    try:
        conn = _get_conn()
        conn.execute("""
            INSERT INTO profiles (user_id, full_name, company, job_title, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                full_name = excluded.full_name,
                company = excluded.company,
                job_title = excluded.job_title,
                updated_at = excluded.updated_at
        """, (
            user_id,
            data.get("full_name", ""),
            data.get("company", ""),
            data.get("job_title", ""),
            now
        ))
        conn.commit()
        conn.close()
        print(f"[SQLite] Saved profile for {user_id}")
        return True
    except Exception as e:
        print(f"[ERROR] SQLite profile save error: {e}")
        return False

def get_user_profile(user_id: str):
    """Fetch a user's profile. Firestore primary, SQLite fallback."""
    empty = {"full_name": "", "company": "", "job_title": "", "updated_at": ""}

    if db:
        try:
            doc = db.collection('profiles').document(user_id).get()
            if doc.exists:
                return doc.to_dict()
            return empty
        except Exception as e:
            print(f"⚠️  Firestore profile read failed: {e}")

    try:
        conn = _get_conn()
        row = conn.execute(
            "SELECT full_name, company, job_title, updated_at FROM profiles WHERE user_id = ?",
            (user_id,)
        ).fetchone()
        conn.close()
        return dict(row) if row else empty
    except Exception as e:
        print(f"[ERROR] SQLite profile read error: {e}")
        return empty
