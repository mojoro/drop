# Qwen3-TTS sidecar
#
# GPU is strongly recommended. To enable GPU passthrough from Docker:
#   1. Install NVIDIA Container Toolkit on the host:
#      https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html
#   2. Start with the 'qwen' Docker Compose profile:
#      docker compose --profile qwen up
#      (the qwen-tts service already includes the 'deploy: devices' config)
#
# Without GPU the server starts but inference will be very slow.

FROM python:3.12-slim

WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Install dependencies (uv resolves without a lock file on first build)
COPY pyproject.toml ./
RUN uv sync --no-dev

COPY main.py ./

EXPOSE 8001

CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
