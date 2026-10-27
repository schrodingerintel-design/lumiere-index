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

# Run schema migrations, then serve. Production never generates demo audience data.
CMD ["sh", "-c", "alembic upgrade head; exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --timeout-keep-alive 75"]
