FROM node:20-slim AS web
WORKDIR /web
COPY package.json ./
RUN npm install
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/main.py .
COPY --from=web /web/dist /app/dist
ENV PORT=8000 STATIC_DIR=/app/dist
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT}
