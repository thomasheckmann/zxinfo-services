FROM node:6.2.2

# Add our user and group first to make sure their IDs get assigned consistently
RUN groupadd -r app && useradd -r -g app app 

# Create app directory
RUN mkdir -p /usr/src/app
RUN chown app /usr/src/app
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json /usr/src/app/
RUN npm install

# Bundle app source
COPY . /usr/src/app

RUN chown -R app:app /usr/src/app
# Default express port
EXPOSE 3000

USER app
CMD [ "npm", "start" ]
