FROM node:20.9.0

ENV WORKDIR='/app'
ENV DB_NAME="deliver"
ENV DB_USER="postgres"
ENV DB_PASSWORD=""
ENV DB_HOST="localhost"

WORKDIR $WORKDIR
COPY ./src ${WORKDIR}/src
ADD ./package.json ./package-lock.json ./tsconfig.json ${WORKDIR}

RUN npm i

RUN npm run build

CMD npm run start