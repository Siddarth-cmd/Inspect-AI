import os
import re
import json
import time
import io
from PIL import Image
from google import genai
from google.genai import types

# ─── API Setup ───────────────────────────────────────────────────────────────

api_key = os.getenv("GEMINI_API_KEY")
client  = None

if not api_key:
    print("[WARNING] GEMINI_API_KEY not set — AI analysis will fail.")
else:
    client = genai.Client(api_key=api_key)
    print(f"[OK] Gemini API (google-genai) configured (key ends: ...{api_key[-6:]})")

MODEL_NAME  = "gemini-2.5-flash"
MAX_RETRIES = 3

# ─── Prompt ──────────────────────────────────────────────────────────────────

PROMPT = """You are an expert industrial quality control AI and materials engineer.
Analyze this product image carefully for manufacturing defects: cracks, scratches, dents, or any surface damage.

You MUST respond with ONLY a valid JSON object. No markdown, no code fences, no explanatory text — raw JSON only.

Use this EXACT schema (no extra keys, no missing keys):

{
  "defect_detected": <boolean>,
  "defects": [
    {
      "type": "<crack|scratch|dent>",
      "confidence": <float 0.0-1.0>,
      "severity": "<Low|Medium|High>",
      "explanation": "<1-2 sentences: where and what the defect is>",
      "cause": "<1-2 sentences: likely root cause>",
      "solution": "<2-3 sentences: how to repair or prevent>",
      "bbox": [<ymin float>, <xmin float>, <ymax float>, <xmax float>]
    }
  ],
  "quality_score": <integer 0-100>,
  "overall_explanation": "<1-2 sentences: overall product condition>",
  "recommendation": "<Pass|Review|Reject>"
}

Rules:
- quality_score: 90-100 = no defects, 70-89 = Low severity, 40-69 = Medium, 0-39 = High severity
- bbox: normalized coords (0.0-1.0), [ymin, xmin, ymax, xmax], top-left=(0,0) bottom-right=(1,1)
- If no defects found: defects=[], defect_detected=false, quality_score 95-100, recommendation="Pass"
- Every defect MUST have all 7 fields including bbox
"""

# ─── JSON Extraction ─────────────────────────────────────────────────────────

def _extract_json(text: str) -> dict:
    """Robustly extract JSON from model output — handles fences, embedded JSON."""
    text = text.strip()
    # 1. Direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # 2. Strip markdown code fences
    m = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
    if m:
        try:
            return json.loads(m.group(1).strip())
        except json.JSONDecodeError:
            pass
    # 3. Find outermost { ... } block
    m = re.search(r'\{[\s\S]*\}', text)
    if m:
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            pass
    raise ValueError(f"No valid JSON found. Raw: {text[:300]}")

# ─── Schema Normalisation ─────────────────────────────────────────────────────

VALID_TYPES    = {"crack", "scratch", "dent"}
VALID_SEVERITY = {"Low", "Medium", "High"}
VALID_RECS     = {"Pass", "Review", "Reject"}

def _normalise(result: dict) -> dict:
    defects = result.get("defects", [])
    if not isinstance(defects, list):
        defects = []

    clean = []
    for d in defects:
        if not isinstance(d, dict):
            continue
        dtype    = str(d.get("type", "crack")).lower()
        severity = d.get("severity", "Medium")
        conf     = float(d.get("confidence", 0.8))
        bbox     = d.get("bbox", [0.1, 0.1, 0.9, 0.9])

        if dtype    not in VALID_TYPES:    dtype    = "crack"
        if severity not in VALID_SEVERITY: severity = "Medium"
        conf = max(0.0, min(1.0, conf))
        if not isinstance(bbox, list) or len(bbox) != 4:
            bbox = [0.1, 0.1, 0.9, 0.9]
        bbox = [max(0.0, min(1.0, float(v))) for v in bbox]

        clean.append({
            "type":        dtype,
            "confidence":  round(conf, 3),
            "severity":    severity,
            "explanation": str(d.get("explanation", "Defect observed on product surface.")),
            "cause":       str(d.get("cause",       "Root cause under investigation.")),
            "solution":    str(d.get("solution",    "Consult quality control engineer.")),
            "bbox":        bbox,
        })

    result["defects"]         = clean
    result["defect_detected"] = len(clean) > 0

    score = result.get("quality_score")
    try:
        score = max(0, min(100, int(score)))
    except (TypeError, ValueError):
        if not clean:
            score = 97
        elif any(d["severity"] == "High"   for d in clean): score = 25
        elif any(d["severity"] == "Medium" for d in clean): score = 55
        else:                                                score = 78
    result["quality_score"] = score

    rec = result.get("recommendation", "")
    if rec not in VALID_RECS:
        rec = "Pass" if score >= 80 else ("Review" if score >= 50 else "Reject")
    result["recommendation"] = rec

    if not result.get("overall_explanation"):
        result["overall_explanation"] = (
            "No defects detected. Product is in excellent condition."
            if not clean else
            f"{len(clean)} defect(s) detected. Quality score: {score}/100."
        )

    return result

# ─── Main Entry Point ─────────────────────────────────────────────────────────

def analyze_image(image_bytes: bytes) -> dict:
    if not client:
        return {"error": "GEMINI_API_KEY is not set in .env"}

    # Validate & convert image
    try:
        img = Image.open(io.BytesIO(image_bytes))
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        # Re-encode to JPEG bytes for the API
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=90)
        jpeg_bytes = buf.getvalue()
    except Exception as e:
        return {"error": f"Invalid image file: {e}"}

    # Build image part for new SDK
    image_part = types.Part.from_bytes(data=jpeg_bytes, mime_type="image/jpeg")

    config = types.GenerateContentConfig(
        temperature=0.1,
        top_p=0.95,
        top_k=40,
        max_output_tokens=4096,
        response_mime_type="application/json",
    )

    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            print(f"[Gemini] Attempt {attempt}/{MAX_RETRIES} — sending to {MODEL_NAME}...")
            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=[PROMPT, image_part],
                config=config,
            )
            raw = response.text
            print(f"[Gemini] Response received ({len(raw)} chars)")
            result = _extract_json(raw)
            result = _normalise(result)
            print(f"[Gemini] OK — score={result['quality_score']}, "
                  f"defects={len(result['defects'])}, verdict={result['recommendation']}")
            return result

        except Exception as e:
            last_error = str(e)
            print(f"[Gemini] Attempt {attempt} failed: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(1.5 * attempt)

    return {"error": f"Gemini API failed after {MAX_RETRIES} attempts: {last_error}"}
