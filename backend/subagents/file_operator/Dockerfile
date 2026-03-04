FROM python:3.11-slim
WORKDIR /app
COPY ./requirements.txt /app/requirements.txt
RUN pip install -r requirements.txt
COPY ./backend/subagents/common /app/common
COPY ./backend/subagents/file_operator /app/file_operator
CMD ["python", "file_operator/main.py"]