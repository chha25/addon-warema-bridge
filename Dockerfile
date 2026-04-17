FROM ghcr.io/home-assistant/base:latest

# Install runtime requirements for add-on and native build tooling for serial dependencies.
RUN apk add --no-cache \
    nodejs \
    npm \
    libstdc++ \
  && apk add --no-cache --virtual .build-deps \
    python3 \
    make \
    g++ \
    linux-headers

WORKDIR /srv

COPY warema-bridge/rootfs/srv/package-lock.json ./
COPY warema-bridge/rootfs/srv/package.json ./

RUN npm ci --omit=dev \
  && apk del --no-cache --purge .build-deps \
  && rm -rf /root/.npm /root/.cache

COPY warema-bridge/rootfs/ /

RUN chmod a+x /etc/services.d/warema-bridge/run

