#!/usr/bin/env bash
set -e

docker compose up -d "$@"

PORT=$(docker compose port app 3000 | cut -d: -f2)
echo ""
echo "  Drop is starting at http://localhost:$PORT"
echo ""
echo "  On first run the TTS sidecar downloads its model (~400 MB)."
echo "  The app will be ready once both containers are healthy."
echo "  Watch progress: docker compose logs -f tts"
echo ""
echo "  Logs: docker compose logs -f"
echo "  Stop: docker compose down"
