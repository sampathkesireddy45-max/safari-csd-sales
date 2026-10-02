# Multi-stage Dockerfile for Safari CSD Sales & Stock Telemetry Platform

# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Python Backend
FROM python:3.12-slim
WORKDIR /app

# Install system libraries needed for psycopg2, pillow, etc.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r ./backend/requirements.txt

# Copy backend application files
COPY backend/ ./backend/
RUN mkdir -p /app/backend/uploads/damage_photos

# Copy compiled frontend from Stage 1 into the location expected by main.py
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

ENV PYTHONUNBUFFERED=1
ENV PORT=8000

EXPOSE 8000

WORKDIR /app/backend
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
