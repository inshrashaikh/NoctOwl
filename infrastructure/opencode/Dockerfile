FROM oven/bun:1 AS base
WORKDIR /app

# OpenCode v2 CLI. Pin the version so CI builds are reproducible.
RUN bun install -g --trust @opencode/cli@2.4.1

# Non-root user (UID 1001; oven/bun:1 already uses 1000)
RUN useradd -m -u 1001 opencode && chown -R opencode:opencode /app
USER opencode

ENTRYPOINT ["opencode"]
