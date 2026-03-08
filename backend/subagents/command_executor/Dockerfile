FROM python:3.11-slim
RUN apt-get update && apt-get install -y curl nodejs npm git
WORKDIR /app
COPY ./requirements.txt /app/requirements.txt
RUN pip install -r requirements.txt
ENV PYTHONPATH=/app
CMD ["python", "backend/subagents/command_executor/main.py"]