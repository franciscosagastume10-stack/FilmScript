FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-venv \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json requirements.txt ./
RUN npm ci --omit=dev \
  && python3 -m venv /opt/filmscript-venv \
  && /opt/filmscript-venv/bin/pip install --no-cache-dir -r requirements.txt

# The container can run FilmScript as a complete single-origin app. This also
# includes every backend module used by server.js and every frontend asset, so
# the same image works on ECS, Render, Railway, Fly.io, or a Docker host.
COPY *.js *.html *.css *.py ./
COPY assets ./assets
COPY scripts ./scripts
COPY docs ./docs

RUN mkdir -p /data && chown node:node /data

ENV NODE_ENV=production
ENV PORT=4173
ENV PDF_PYTHON=/opt/filmscript-venv/bin/python3
ENV FILMSCRIPT_DATA_DIR=/data

EXPOSE 4173

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4173) + '/api/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1))"

USER node

CMD ["node", "server.js"]
