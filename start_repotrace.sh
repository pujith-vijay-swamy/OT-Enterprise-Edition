#!/bin/bash
echo "======================================================================="
echo "         RepoTrace AI -- Enterprise Microservice Platform Launcher"
echo "======================================================================="
echo ""

echo "Starting RepoTrace Python AST Backend Server on http://localhost:4400 ..."
python3 engine/repotrace/server.py &
SERVER_PID=$!

sleep 2

echo "Starting Next.js Enterprise Web Console on http://localhost:3000 ..."
cd web && npm run dev &
WEB_PID=$!

echo ""
echo "======================================================================="
echo " RepoTrace AI Platform Services Active:"
echo "  - Web Console: http://localhost:3000"
echo "  - AST Engine Backend: http://localhost:4400"
echo "======================================================================="

wait $SERVER_PID $WEB_PID
