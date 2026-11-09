# agent-box: throwaway Linux sandbox for delegated AI agents. Sees only /xfer (task in, patch out) and /auth (read-only).
FROM node:24-bookworm

ARG PNPM_VERSION=10.23.0
ARG OPENCODE_VERSION=latest
ARG CODEX_VERSION=latest
ARG CLAUDE_VERSION=latest
ARG GROK_VERSION=

RUN apt-get update \
 && apt-get install -y --no-install-recommends git ripgrep curl ca-certificates jq procps python3 python3-venv make g++ \
 && rm -rf /var/lib/apt/lists/*

# Secret and vulnerability scanners that quality gates commonly call.
RUN curl -fsSL https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz \
    | tar -xz -C /usr/local/bin gitleaks \
 && curl -fsSL -o /usr/local/bin/osv-scanner https://github.com/google/osv-scanner/releases/download/v2.6.0/osv-scanner_linux_amd64 \
 && chmod +x /usr/local/bin/osv-scanner

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate \
 && npm install -g opencode-ai@${OPENCODE_VERSION} @openai/codex@${CODEX_VERSION} @anthropic-ai/claude-code@${CLAUDE_VERSION} \
 && npx -y playwright@1 install-deps chromium \
 && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /work /home/node/.pkg-cache && chown node:node /work /home/node/.pkg-cache
USER node
ENV HOME=/home/node \
    PATH=/home/node/.grok/bin:/home/node/.local/bin:$PATH \
    npm_config_store_dir=/home/node/.pkg-cache/pnpm \
    npm_config_cache=/home/node/.pkg-cache/npm
RUN curl -fsSL https://x.ai/cli/install.sh | bash -s ${GROK_VERSION} \
 && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY --chown=node:node entry.sh /home/node/entry.sh
WORKDIR /work
ENTRYPOINT ["bash", "/home/node/entry.sh"]
