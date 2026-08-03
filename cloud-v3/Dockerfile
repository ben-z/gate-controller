# syntax = docker/dockerfile:1


# Adjust NODE_VERSION as desired
ARG NODE_VERSION=22.11.0
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Next.js"

# Next.js app lives here
WORKDIR /app

# Pass information about the build to the container
ARG DOCKER_METADATA_OUTPUT_JSON='{}'
ENV DOCKER_METADATA_OUTPUT_JSON=${DOCKER_METADATA_OUTPUT_JSON}

# Set production environment
ENV NODE_ENV="production"
# Build timzone into the image
ENV NEXT_PUBLIC_CONTROLLER_TIMEZONE='America/Vancouver'


# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Install node modules
COPY package-lock.json package.json ./
RUN REDISMS_DISABLE_POSTINSTALL=1 npm ci --include=dev

# Copy application code
COPY . .

ARG SOURCE_SHA
RUN test "${#SOURCE_SHA}" -eq 40 && ! printf '%s' "$SOURCE_SHA" | grep -q '[^0-9a-f]'
ENV APP_VERSION=${SOURCE_SHA}

# Build application
RUN npx next build --experimental-build-mode compile

# Remove development dependencies
RUN npm prune --omit=dev


# Final stage for app image
FROM base

# Install redis-server
RUN apt-get update && apt-get install -y lsb-release curl gpg
RUN curl -fsSL https://packages.redis.io/gpg | gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg \
    && chmod 644 /usr/share/keyrings/redis-archive-keyring.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" | tee /etc/apt/sources.list.d/redis.list
RUN apt-get update && apt-get install -y redis-server

# Copy built application
COPY --from=build /app /app

# Set up application state on a separate volume
RUN mkdir -p /data/redis && chown -R node:node /data
VOLUME /data

# Keep the app-specific Redis config somewhere the non-root app user can read.
ENV REDIS_CONFIG_FILE='/app/redis.conf'
COPY --chmod=0444 redis.conf ${REDIS_CONFIG_FILE}

ARG SOURCE_SHA
RUN test "${#SOURCE_SHA}" -eq 40 && ! printf '%s' "$SOURCE_SHA" | grep -q '[^0-9a-f]'
ENV APP_VERSION=${SOURCE_SHA}

# Entrypoint sets up the container.
ENTRYPOINT [ "/usr/local/bin/npm" ]

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
ENV PORT=3000
ENV DB_PATH='/data/sqlite.db'
ENV REDIS_HOST='localhost'
ENV REDIS_PORT='6379'
# Also set INITIAL_ADMIN_CREDENTIALS at runtime. In fly.io, this can be done via `fly secrets set INITIAL_ADMIN_CREDENTIALS=...`

USER node

# Fail the image build if production prerequisites are inaccessible to the runtime user.
RUN test -r "${REDIS_CONFIG_FILE}" && test -w /data/redis

CMD [ "run", "prod:all" ]
