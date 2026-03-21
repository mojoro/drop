docker compose up -d @args

$port = (docker compose port app 3000).Split(":")[1]
Write-Host ""
Write-Host "  Drop is starting at http://localhost:$port"
Write-Host ""
Write-Host "  On first run the TTS sidecar downloads its model (~400 MB)."
Write-Host "  The app will be ready once both containers are healthy."
Write-Host "  Watch progress: docker compose logs -f tts"
Write-Host ""
Write-Host "  Logs: docker compose logs -f"
Write-Host "  Stop: docker compose down"
