@echo off
title OmniTrace AI -- Enterprise Passive Contract Governance Platform
echo =======================================================================
echo          OmniTrace AI -- Enterprise Microservice Platform Launcher
echo =======================================================================
echo.

echo Starting OmniTrace Python AST Backend Server on http://localhost:4400 ...
start "OmniTrace API Backend" cmd /k "python d:\OT\engine\omnitrace\server.py"

timeout /t 2 /nobreak > NUL

echo Starting Next.js Enterprise Web Console on http://localhost:3001 ...
cd /d d:\OT\web
start "OmniTrace Web Console" cmd /k "npm run dev"

echo.
echo =======================================================================
echo  OmniTrace AI Platform Services Active:
echo   - Web Console: http://localhost:3001
echo   - AST Engine Backend: http://localhost:4400
echo =======================================================================
