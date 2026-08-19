FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-venv \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json requirements.txt ./
RUN npm ci --omit=dev \
  && python3 -m venv /opt/filmscript-venv \
  && /opt/filmscript-venv/bin/pip install --no-cache-dir -r requirements.txt

# Production serves the frontend from Vercel. Keep the API image intentionally
# small and copy only runtime modules and PDF workers; public HTML/assets,
# build scripts, documentation and source-only helpers do not belong in the
# internet-facing backend container.
COPY server.js database.js budget-model.js budget-import-model.js calendar-model.js analysis-model.js ./
COPY reference-storage.js canvas-model.js canvas-storage.js s3-storage.js ./
COPY platform-database.js permissions-model.js invitation-mailer.js ai-router.js collaboration-engine.js location-plan-model.js translation-policy.js ./
COPY realtime-collaboration.js ./
COPY migrations ./migrations
COPY *.py ./

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
