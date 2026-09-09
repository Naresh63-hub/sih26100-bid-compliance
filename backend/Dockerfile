# =====================================================================
# BIDGUARD AI — Production Backend Dockerfile
# FastAPI + PyMuPDF + PostgreSQL Compliance & Risk Intelligence Engine
# =====================================================================

FROM python:3.12-slim

# System dependencies for PDF processing, network health checks, and build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    libmupdf-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy application source and configuration
COPY backend/app backend/app
COPY backend/migrations backend/migrations
COPY alembic.ini .
COPY data data

# Create workspace directory for temporary document processing
RUN mkdir -p /app/backend/work/documents

ENV PYTHONPATH=/app/backend \
    PYTHONUNBUFFERED=1 \
    PORT=8000

EXPOSE 8000

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

# Execute migrations and run uvicorn server
CMD ["sh", "-c", "alembic upgrade head 2>/dev/null || true; uvicorn app.main:app --host 0.0.0.0 --port 8000"]
