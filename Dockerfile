FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p data resume/gerados

RUN groupadd -r vagabot && useradd -r -g vagabot vagabot \
    && chown -R vagabot:vagabot /app

USER vagabot

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]
