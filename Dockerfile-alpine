FROM node:7.4.0-alpine

# Add git stuff to image
RUN apk update && apk upgrade && \
    apk add --no-cache bash git openssh

# Add our user and group first to make sure their IDs get assigned consistently
RUN addgroup -S app && adduser -h /usr/src/app -H -S -G app app

# Create app directory
RUN mkdir -p /usr/src/app
RUN chown app.app /usr/src/app
WORKDIR /usr/src/app

USER app

# Install app dependencies
COPY package.json /usr/src/app/
RUN npm install

# Bundle app source
COPY . /usr/src/app

# Default express port
EXPOSE 3000

CMD [ "npm", "start" ]
