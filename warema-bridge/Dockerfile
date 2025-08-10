ARG BUILD_FROM
FROM $BUILD_FROM

LABEL io.hass.type="addon"
LABEL io.hass.version="1.0"
LABEL io.hass.arch="${BUILD_ARCH:-amd64}"

ENV LANG C.UTF-8
ENV NODE_ENV production

RUN apk add --no-cache     nodejs     npm     ca-certificates     && rm -rf /var/cache/apk/*

WORKDIR /app

COPY package*.json /app/
RUN npm ci --only=production

COPY . /app

COPY run.sh /run.sh
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
