FROM python:3.11-slim
WORKDIR /app
COPY ./requirements.txt /app/requirements.txt
RUN pip install -r requirements.txt
ENV PYTHONPATH=/app
CMD ["python", "backend/subagents/file_operator/main.py"]