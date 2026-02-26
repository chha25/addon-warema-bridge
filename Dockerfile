ARG BUILD_FROM
FROM $BUILD_FROM


# Install requirements for add-on
RUN apk add --no-cache \
    nodejs \
    npm \
    python3 \
    make \
    g++ \
    linux-headers


COPY warema-bridge/rootfs/srv/package-lock.json /srv
COPY warema-bridge/rootfs/srv/package.json /srv

WORKDIR /srv

RUN npm ci --omit=dev

COPY warema-bridge/rootfs/ /

RUN chmod a+x /etc/services.d/warema-bridge/run

CMD ["/init"]
