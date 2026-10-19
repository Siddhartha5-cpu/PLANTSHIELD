@echo off
echo ========================================================
echo   PlantShield AI - Automated Environment Setup
echo ========================================================
echo.

:: 1. Setup AI Service (Port 8000)
echo [1/3] Setting up AI Service (Python virtual environment)...
cd ai-service
if not exist venv (
    python -m venv venv
)
call venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
call deactivate
cd ..
echo [OK] AI Service setup complete!
echo.

:: 2. Setup Backend Orchestrator (Port 5000)
echo [2/3] Setting up Backend Orchestrator (Python virtual environment)...
cd backend
if not exist venv (
    python -m venv venv
)
call venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
call deactivate

:: Check for .env in backend
if not exist .env (
    echo [NOTE] Creating .env from .env.example...
    copy .env.example .env
    echo [ACTION REQUIRED] Please verify or update your GEMINI_API_KEY in backend\.env
)
cd ..
echo [OK] Backend setup complete!
echo.

:: 3. Setup Frontend Dashboard
echo [3/3] Setting up Frontend Dashboard (Node dependencies)...
cd frontend
call npm install
cd ..
echo [OK] Frontend setup complete!
echo.

echo ========================================================
echo   Setup Complete! You can now run 'start_services.bat'
echo ========================================================
pause
