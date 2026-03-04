FROM python:3.11-slim

# Install system dependencies if required
RUN apt-get update && apt-get install -y gcc curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy global requirements
COPY ./requirements.txt /app/requirements.txt

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Set PYTHONPATH so absolute imports like `backend.database...` resolve properly
ENV PYTHONPATH=/app

# Start the FastAPI Orchestrator server
CMD ["python", "backend/orchestrator/main.py"]