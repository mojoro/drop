docker compose up -d @args

$port = (docker compose port app 3000).Split(":")[1]
Write-Host ""
Write-Host "  Drop is running at http://localhost:$port"
Write-Host ""
Write-Host "  Logs: docker compose logs -f"
Write-Host "  Stop: docker compose down"
