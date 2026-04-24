FROM python:3.11-slim
WORKDIR /app
RUN pip install --no-cache-dir mem0ai ollama
# サーバーとして常駐させるためのダミーコマンド
CMD ["python3", "-c", "import time; print('NEXUS Memory Server is running...'); [time.sleep(3600) for _ in range(24)]"]
