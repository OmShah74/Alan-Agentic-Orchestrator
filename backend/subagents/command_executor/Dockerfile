FROM python:3.11-slim
RUN apt-get update && apt-get install -y curl nodejs npm git
WORKDIR /app
COPY ./requirements.txt /app/requirements.txt
RUN pip install -r requirements.txt
COPY ./backend/subagents/common /app/common
COPY ./backend/subagents/command_executor /app/command_executor
CMD ["python", "command_executor/main.py"]