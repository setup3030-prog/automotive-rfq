@echo off
cd /d "%~dp0"

start "Backend" cmd /k "cd backend && venv\Scripts\activate && uvicorn app.main:app --port 8000"

timeout /t 3 /nobreak >nul

start "Frontend" cmd /k "cd frontend && npm run dev"

timeout /t 5 /nobreak >nul

start http://localhost:5173
