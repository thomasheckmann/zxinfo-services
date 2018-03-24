'use strict';

var tools = require('./utils');

var config = require('../config.json')[process.env.NODE_ENV || 'development'];
var express = require('express');
var router = express.Router();

var elasticsearch = require('elasticsearch');
var debug = require('debug')('zxinfo-services:apiv1');

var elasticClient = new elasticsearch.Client({
    host: config.es_host,
    apiVersion: config.es_apiVersion,
    log: config.es_log
});

var es_index = config.zxinfo_index;

var getSortObject = function(sort_mode) {
    var sort_object;

    if (sort_mode === 'title_asc') {
        sort_object = [{
            "fulltitle.raw": {
                "order": "asc"
            }
        }];
    } else if (sort_mode === 'title_desc') {
        sort_object = [{
            "fulltitle.raw": {
                "order": "desc"
            }
        }];
    } else if (sort_mode === 'date_asc') {
        sort_object = [{
            "yearofrelease": {
                "order": "asc"
            }
        },
        {
            "monthofrelease": {
                "order": "asc"
            }
        },
        {
            "dayofrelease": {
                "order": "asc"
            }
        }];
    } else if (sort_mode === 'date_desc') {
         sort_object = [{
            "yearofrelease": {
                "order": "desc"
            }
        },
        {
            "monthofrelease": {
                "order": "desc"
            }
        },
        {
            "dayofrelease": {
                "order": "desc"
            }
        }];
    }
    return sort_object;
}

/**
 * Test case:
 *      - pick game from frontpage (or result page)
 *      - direct link to detail page '/details/0002259'
 *
 * Notes:
 *      - TODO: Invalid ID is not handled in any way
 */
var getGameById = function(gameid) {
    debug('getGameById(' + gameid + ')');
    return elasticClient.get({
        "index": es_index,
        "type": es_index,
        "id": gameid
    });
}

/**
 * Test case:
 *      - click publisher from result page
 *      - direct link to publisher list '/publisher/ZX-Guaranteed'
 *
 * Notes:
 *      - 
 */
var getGamesByPublisher = function(name, page_size, offset, sort) {
    debug('getGamesByPublisher()');

    var sort_mode = sort == undefined ? "date_desc" : sort;
    var sort_object = getSortObject(sort_mode);

    return elasticClient.search({
        "index": es_index,
        "body": {
            "size": page_size,
            "from": offset * page_size,
            "query": {
                "bool": {
                    "must": {
                        "match_all": {}
                    },
                    "filter": {
                        "bool": {
                            "should": [{
                                "nested": {
                                    "path": "publisher",
                                    "query": {
                                        "bool": {
                                            "must": [{
                                                "match": {
                                                    "publisher.name.keyword": name
                                                }
                                            }]
                                        }
                                    }
                                }
                            }, {
                                "nested": {
                                    "path": "releases",
                                    "query": {
                                        "bool": {
                                            "must": [{
                                                "match": {
                                                    "releases.publisher.keyword": name
                                                }
                                            }]
                                        }
                                    }
                                }
                            }, {
                                "nested": {
                                    "path": "authors",
                                    "query": {
                                        "bool": {
                                            "must": [{
                                                "match": {
                                                    "authors.group.raw": name
                                                }
                                            }]
                                        }
                                    }
                                }
                            }, {
                                "nested": {
                                    "path": "authors.authors",
                                    "query": {
                                        "bool": {
                                            "must": [{
                                                "match": {
                                                    "authors.authors.name.keyword": name
                                                }
                                            }]
                                        }
                                    }
                                }
                            }]
                        }
                    }
                }
            },
            "sort": sort_object
        }
    })
};

/**
 * Test case:
 *      - http://localhost:8300/api/zxinfo/publishers/Bug-Byte%20Software%20Ltd/games/Manic%20Miner
 *      - Manic Miner details -> Series -> Jet Set Willy
 *
 * Notes:
 *      - 
 */
var getGameByPublisherAndName = function(name, title) {
    debug('getGameByPublisherAndName()');
    return elasticClient.search({
        "index": es_index,
        "body": {
            "size": 1,
            "query": {
                "bool": {
                    "must": {
                        "match": {
                            "fulltitle.raw": title
                        }
                    },
                    "filter": {
                        "nested": {
                            "path": "publisher",
                            "query": {
                                "bool": {
                                    "must": [{
                                        "term": {
                                            "publisher.name.raw": name
                                        }
                                    }]
                                }
                            }
                        }
                    }
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
    // debug("user-agent: " + req.headers['user-agent']);
    next(); // make sure we go to the next routes and don't stop here
});

/**
    Return game with :gameid
*/
router.get('/games/:gameid', function(req, res, next) {
    debug('==> /games/:gameid');
    debug(req.params.gameid + ' ==> length=' + req.params.gameid.length + ', integer=' + Number.isInteger(parseInt(req.params.gameid)));

    if (Number.isInteger(parseInt(req.params.gameid)) && (req.params.gameid.length < 8)) {
        var id = ('0000000' + req.params.gameid).slice(-7);
        getGameById(id).then(function(result) {
            res.send(tools.zxdbResultSingle(result, req.query.mode));
        }, function(reason) {
            res.status(404).end();
        });
    } else {
        res.status(400).end();
    }
});

/**
    Returns a list of games for publisher :name

    http://blog.mwaysolutions.com/2014/06/05/10-best-practices-for-better-restful-api/

    Paging
    Use limit and offset. It is flexible for the user and common in leading databases. The default should be limit=20 and offset=0
    To send the total entries back to the user use the custom HTTP header: X-Total-Count.
*/
router.get('/publishers/:name/games', function(req, res, next) {
    debug('==> /publishers/:name/games');

    getGamesByPublisher(req.params.name, req.query.size, req.query.offset, req.query.sort).then(function(result) {
        res.header("X-Total-Count", result.hits.total);
        res.send(tools.zxdbResultList(result, req.query.mode));
    });
});

/**
    Return game with :title published by :name
*/
router.get('/publishers/:name/games/:title', function(req, res, next) {
    debug('==> /publishers/:name/games/:title');

    getGameByPublisherAndName(req.params.name, req.params.title).then(function(result) {
        if (result.hits.hits.length === 0) {
            res.status(404).end();
        } else {
            res.send(tools.zxdbResultSingle(result.hits.hits[0], req.query.mode));
        }
    });
});

module.exports = router;