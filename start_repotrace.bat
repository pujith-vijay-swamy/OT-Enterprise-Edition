@echo off
title RepoTrace AI -- Enterprise Passive Contract Governance Platform
echo =======================================================================
echo          RepoTrace AI -- Enterprise Microservice Platform Launcher
echo =======================================================================
echo.

echo Starting RepoTrace Python AST Backend Server on http://localhost:4400 ...
start "RepoTrace API Backend" cmd /k "python engine\repotrace\server.py"

timeout /t 2 /nobreak > NUL

echo Starting Next.js Enterprise Web Console on http://localhost:3000 ...
cd web
start "RepoTrace Web Console" cmd /k "npm run dev"

echo.
echo =======================================================================
echo  RepoTrace AI Platform Services Active:
echo   - Web Console: http://localhost:3000
echo   - AST Engine Backend: http://localhost:4400
echo =======================================================================
