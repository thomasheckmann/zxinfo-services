'use strict';

var config = require('../config.json')[process.env.NODE_ENV || 'development'];
var express = require('express');
var router = express.Router();
var elasticsearch = require('elasticsearch');

var elasticClient = new elasticsearch.Client({
    host: config.es_host,
    apiVersion: config.es_apiVersion,
    log: config.log
});

var es_index = config.zxinfo_index;
var es_index_type = config.zxinfo_type;

var media_url = 'http://incubator.kolbeck.dk/media';
var books_url = 'https://archive.zx-spectrum.org.uk/WoS';
var hw_url = 'https://archive.zx-spectrum.org.uk';

var debug = require('debug')('zxinfo-services:social');

var getGameById = function(gameid) {
    debug('getGameById()');
    return elasticClient.get({
        "index": es_index,
        "type": es_index_type,
        "id": gameid
    });
}


function loadscreen(source) {
    // iterate all additionals to find loading screen, if any
    var loadscreen = null;
    if (source.type == "Compilation") {
        loadscreen = "/images/compilation.png";
    } else if (typeof(source.screens) != "undefined") {
        var idx = 0;
        var screen = null;
        for (; loadscreen == null && idx < source.screens.length; idx++) {
            if ("Loading screen" == source.screens[idx].type && "Picture" == source.screens[idx].format) {
                loadscreen = source.screens[idx].url;
            }
        }
    }

    if (loadscreen == null) {
        loadscreen = media_url + "/images/empty.png";
    } else if (source.contenttype == "BOOK") {
        loadscreen = books_url + loadscreen;
    } else if (source.contenttype == "HARDWARE") {
        loadscreen = hw_url + loadscreen;
    } else {
        loadscreen = media_url + loadscreen;

    }

    return loadscreen;
}

// middleware to use for all requests
router.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    // do logging
    // debug("user-agent: " + req.headers['user-agent']);
    next(); // make sure we go to the next routes and don't stop here
});

/**
    Return game with :gameid
*/
router.get('/details/:gameid', function(req, res, next) {

    getGameById(req.params.gameid).then(function(result) {
    	var og_url = 'http://zxinfo.dk/details/' + req.params.gameid; // req.protocol + '://' + req.get('host') + req.originalUrl; // points to this endpoint
    	var og_title = result._source.fulltitle;
    	var og_image = loadscreen(result._source);
    	var og_description = result._source.machinetype + ', ' + result._source.type + ' - ' + result._source.releases[0].name + '('+result._source.yearofrelease+')';
		res.render('social', { title: 'ZXInfo - The open source ZXDB frontend', og_url: og_url, og_title: og_title, og_image: og_image, og_description: og_description});
    });
});

router.get('/*', function(req, res, next) {
	var og_url = 'http://zxinfo.dk';
	var og_title = 'ZXInfo - The open source ZXDB frontend';
	var og_image = '';
	var og_description = 'Provides a fantastic desktop and mobile friendly interface to search and browse the ZXDB catalogue for almost all Spectrum software, hardware and books ever released.';
	res.render('social', { title: 'ZXInfo - The open source ZXDB frontend', og_url: og_url, og_title: og_title, og_image: og_image, og_description: og_description});
});


module.exports = router;