FROM node:20.9.0

EXPOSE $API_PORT

ENV NODE_ENV='production'
ENV WORKDIR='/app'
ENV DB_NAME="deliver"
ENV DB_USER="postgres"
ENV DB_PASSWORD=""
ENV DB_HOST="localhost"

WORKDIR $WORKDIR

RUN rm -rf node_modules

COPY ./src $WORKDIR/src

ADD ./package.json ./package-lock.json ./tsconfig.json $WORKDIR

RUN npm install -g npm@latest

RUN npm install --force

RUN npm run build

CMD ["npm", "start"]
