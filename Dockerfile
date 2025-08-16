ARG BUILD_FROM
FROM $BUILD_FROM

LABEL io.hass.type="addon"
LABEL io.hass.version="1.0"
LABEL io.hass.arch="${BUILD_ARCH:-amd64}"

ENV LANG C.UTF-8
ENV NODE_ENV production

# Install requirements for add-on
RUN apk add --no-cache \
    nodejs \
    npm \
    python3 \
    make \
    g++ \
    linux-headers

WORKDIR /app

COPY ./warema-bridge/rootfs/srv/package.json /app/
COPY ./warema-bridge/rootfs/srv/package-lock.json /app/
RUN npm ci --only=production

COPY ./warema-bridge/rootfs/srv /app

COPY run.sh /run.sh
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
