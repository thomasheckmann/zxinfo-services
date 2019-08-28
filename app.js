var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var routes = require('./routes/index');

var zxinfo = require('./routes/zxinfo');
var zxinfov2 = require('./routes/zxinfov2');
var magazinesAPI = require('./routes/magazinesAPI');

var zxsuggest = require('./routes/zxsuggest');
var cors = require('cors');
var neo4j = require('./routes/neo4j');
var social = require('./routes/social');

var flatten = require('flat')

var appConfig = require('./config.json');

var app = express();
app.use(cors());

if (process.env.NODE_ENV === undefined) {
    console.log("NODE_ENV not defined, must be 'development' or 'production'");
    process.exit(0);
}

console.log('# APP START ###################################################');
console.log('# RUNNING in mode: ' + process.env.NODE_ENV);
console.log('# nodeJS version: ' + process.version);
console.log('#');
console.log('# CONFIG DUMP #################################################');
console.log(JSON.stringify(appConfig[process.env.NODE_ENV], null, 2));
console.log('###############################################################');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/api/zxinfo', zxinfo);
app.use('/api/zxinfo/v2', zxinfov2);
app.use('/api/zxinfo/v2/magazines', magazinesAPI);
// app.use('/api/zxsuggest', zxsuggest);
app.use('/api/graph', neo4j);
app.use('/social', social);

var proxy = require('express-http-proxy');
app.use('/a.proxy', proxy('https://api.zxinfo.dk', {
    userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
        data = flatten(JSON.parse(proxyResData.toString('utf8')));

        // TODO: Handle 404

        result = "";
        for (let [key, value] of Object.entries(data)) {
            if (key.startsWith('_source.') && value.length > 0) {
                result += key.replace('_source.', '') + "=" + value + "\n";
                console.log(`${key}: ${value}` + '(' + value.length + ')');
            }
        }

        return result;
    }
}));

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// container error handler
// will print stacktrace
if (app.get('env') === 'container') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});


module.exports = app;