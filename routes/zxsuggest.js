var config = require('../config.json')[process.env.NODE_ENV || 'development'];
var express = require('express');
var router = express.Router();

var elasticsearch = require('elasticsearch');

var elasticClient = new elasticsearch.Client({
    host: config.es_host,
    apiVersion: config.es_apiVersion,
    log: config.log
});

var es_index = "zxinfo_suggests";
var es_index_type = "zxinfo_suggests_type_title";

var maxResult = 20;

var getSuggestions = function(q) {
    return elasticClient.suggest({
        index: es_index,
        type: es_index_type,
        body: {
            productsuggest: {
                text: q,
                completion: {
                    field: "suggest",
                    size: maxResult
                }
            }
        }
    })
};

// middleware to use for all requests
router.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    // do logging
    next(); // make sure we go to the next routes and don't stop here
});

/* GET title suggestions for completion */
router.get('/suggest/:query', function(req, res, next) {
    var suggestions = null;
    getSuggestions(req.params.query).then(function(result) {
        suggestions = result.productsuggest[0].options;
        res.send(suggestions);
    });
});

module.exports = router;

