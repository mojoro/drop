#!/usr/bin/env bash
set -e

docker compose up -d "$@"

PORT=$(docker compose port app 3000 | cut -d: -f2)
echo ""
echo "  Drop is running at http://localhost:$PORT"
echo ""
echo "  Logs: docker compose logs -f"
echo "  Stop: docker compose down"
