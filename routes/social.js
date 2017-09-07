'use strict';

var config = require('../config.json')[process.env.NODE_ENV || 'development'];
var express = require('express');
var router = express.Router();

var debug = require('debug')('zxinfo-services:apiv2');



// middleware to use for all requests
router.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    // do logging
    // debug("user-agent: " + req.headers['user-agent']);
    next(); // make sure we go to the next routes and don't stop here
});

router.get('/*', function(req, res, next) {
	var url = req.protocol + '://' + req.get('host') + req.originalUrl; // points to this endpoint

	res.render('social', { title: 'ZXInfo - The open source ZXDB frontend', og_url: 'xx', og_title: 'xx', content: url });
});

module.exports = router;