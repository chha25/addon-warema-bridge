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

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]

