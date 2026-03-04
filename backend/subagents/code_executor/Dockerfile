FROM python:3.11-slim
RUN apt-get update && apt-get install -y nodejs npm
WORKDIR /app
COPY ./requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
ENV PYTHONPATH=/app
CMD ["python", "backend/subagents/code_executor/main.py"]