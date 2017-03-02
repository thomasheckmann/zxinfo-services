# zxinfo-services
This is the backend part for the web app zxinfo-app.

The application is built using the following:

* Node.js
* express
* Elasticsearch

# Installation
To install perform npm install
````
> npm install
````

To start the server execute the start.sh script

````
> NODE_ENV=development ./start.sh
````

And point your browser to http://localhost:3000/api/zxinfo/games/0002259

## Note on 'nodemon'
As config file is generated on app startup, use the following for starting nodemon:

For backend development, start the zxinfo-services with:

````
NODE_ENV=development PORT=8300 nodemon --ignore public/javascripts/config.js
````

# Environment configuration
Check config.json for configuration options.
NOTE the container section (should be used if running containers only)

## Build Docker image

````
> docker build -t heckmann/zx-info-services .
````

## Running container

As local/development
````
> docker run -d -p 3000:3000 -e "NODE_ENV=development" -e "DEBUG=zxinfo-services:*" --name "zxinfo-services-local" heckmann/zx-info-services
````

As production
````
> docker run -d -p 8200:3000 -e "NODE_ENV=production" --name "zxinfo-services-prod" heckmann/zx-info-services
````

## Move container to another location

Export/save container
````
> docker save --output zx-info-services.tar heckmann/zx-info-services
````
Copy zx-info-services.tar to server, and then restore on server

````
> docker load --input zx-into-services.tar
````

# Changelog
## 03-2017
* Improved search for ZXDB structure. Search now queries for fulltitle, alsoknownas, re-released title

## 01-2017
* Added alpine build for Docker
* Upgraded nodeJS to v7.4.0
