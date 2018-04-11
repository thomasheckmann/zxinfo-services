# zxinfo-services
This is the backend part for the web app zxinfo-app.

The application is built using the following:

* Node.js
* express

and requires access to an instance of zxinfo-es to run.


# Installation
To install perform npm install
````
> npm install
````

To start the server execute the start.sh script

````
> NODE_ENV=development PORT=8300 ./start.sh
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

## Build Docker image

````
> docker build -t zx-info-services .
````

## Running container

As production (to use the live instance of zxinfo-es)
````
> docker run -d -p 8300:3000 -e "NODE_ENV=production" --name "zxinfo-services-prod" zx-info-services
````
