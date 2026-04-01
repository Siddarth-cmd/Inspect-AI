@echo off
echo =========================================
echo Starting InspectAI Backend Server...
echo =========================================
start "InspectAI Backend" cmd /k "cd backend && venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --reload"

echo =========================================
echo Starting InspectAI Frontend Server...
echo =========================================
start "InspectAI Frontend" cmd /k "cd frontend && npm run dev -- --host"

echo All servers started!
pause
