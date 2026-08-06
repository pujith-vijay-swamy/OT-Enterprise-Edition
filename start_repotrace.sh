#!/bin/bash
echo "======================================================================="
echo "         OmniTrace AI -- Enterprise Microservice Platform Launcher"
echo "======================================================================="
echo ""

echo "Starting OmniTrace Python AST Backend Server on http://localhost:4400 ..."
python3 engine/omnitrace/server.py &
SERVER_PID=$!

sleep 2

echo "Starting Next.js Enterprise Web Console on http://localhost:3001 ..."
cd web && npm run dev &
WEB_PID=$!

echo ""
echo "======================================================================="
echo " OmniTrace AI Platform Services Active:"
echo "  - Web Console: http://localhost:3001"
echo "  - AST Engine Backend: http://localhost:4400"
echo "======================================================================="

wait $SERVER_PID $WEB_PID
