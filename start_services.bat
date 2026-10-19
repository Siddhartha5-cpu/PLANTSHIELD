@echo off
echo ========================================================
echo   Launching PlantShield AI Services...
echo ========================================================
echo.

:: 1. Start AI Model Service (Port 8000)
echo Starting AI Service on port 8000...
start "PlantShield AI Service [Port 8000]" cmd /k "cd /d %~dp0ai-service && call venv\Scripts\activate && uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

:: Wait 2 seconds
timeout /t 2 /nobreak >nul

:: 2. Start Backend Orchestrator (Port 5000)
echo Starting Backend Orchestrator on port 5000...
start "PlantShield Backend Orchestrator [Port 5000]" cmd /k "cd /d %~dp0backend && call venv\Scripts\activate && uvicorn main:app --host 127.0.0.1 --port 5000 --reload"

:: Wait 2 seconds
timeout /t 2 /nobreak >nul

:: 3. Start Frontend Dashboard (Port 5173)
echo Starting Frontend UI on Vite dev server...
start "PlantShield Frontend Dashboard" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================================
echo   All 3 services have been launched in separate windows!
echo   Frontend will be available at: http://localhost:5173
echo ========================================================
echo.
pause
