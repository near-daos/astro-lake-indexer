FROM node:18-alpine As dependencies

ARG APP_NAME indexer
ENV APP_NAME ${APP_NAME}

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

# requirements
RUN apk update && apk add curl bash && rm -rf /var/cache/apk/*

COPY . .

# install dependencies
RUN npm install

CMD [ "/bin/sh", "entrypoint.sh" ]
