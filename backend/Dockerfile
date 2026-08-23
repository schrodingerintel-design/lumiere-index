FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /code

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential default-libmysqlclient-dev pkg-config curl \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Run migrations and seed data on first boot, then start the server.
CMD ["sh", "-c", "alembic upgrade head && python seed.py; uvicorn app.main:app --host 0.0.0.0 --port 8000 --timeout-keep-alive 75"]
