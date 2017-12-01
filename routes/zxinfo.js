var config = require('../config.json')[process.env.NODE_ENV || 'development'];
var express = require('express');
var router = express.Router();

var elasticsearch = require('elasticsearch');
var debug = require('debug')('zxinfo-services:apiv1');

var elasticClient = new elasticsearch.Client({
    host: config.es_host,
    apiVersion: config.es_apiVersion,
    log: config.log
});

var es_index = config.zxinfo_index;
var es_index_type = config.zxinfo_type;

var getGameById = function(gameid) {
    debug('getGameById()');
    return elasticClient.get({
        "index": es_index,
        "type": es_index_type,
        "id": gameid
    });
}

var getGamesByPublisher = function(name, page_size, offset) {
    debug('getGamesByPublisher()');
    return elasticClient.search({
        "index": es_index,
        "type": es_index_type,
        "body": {
            "size": page_size,
            "from": offset * page_size,
            "query": {
                "filtered": {
                    "query": {
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
                                                    "publisher.name.raw": name
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
                                                    "releases.name.raw": name
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
                                                    "authors.authors.name.raw": name
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
            "sort": [{
                "yearofrelease": {
                    "order": "asc"
                }
            }, {
                "fulltitle": {
                    "order": "asc"
                }
            }]
        }
    })
};

var getGameByPublisherAndName = function(name, title) {
    debug('getGameByPublisherAndName()');
    return elasticClient.search({
        "index": es_index,
        "type": es_index_type,
        "body": {
            "size": 1,
            "query": {
                "filtered": {
                    "query": {
                        "match": {
                            "fulltitle.raw": title
                        }
                    },
                    "filter": {
                        "nested": {
                            "path": "publisher",
                            "filter": {
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


var getGamesByGroup = function(groupid, groupname, page_size, offset) {
    debug('getGamesByGroup()');
    return elasticClient.search({
        "index": es_index,
        "type": es_index_type,
        "body": {
            "size": page_size,
            "from": offset * page_size,
            "query": {
                "bool": {
                    "must": [{
                        "nested": {
                            "path": "features",
                            "query": {
                                "bool": {
                                    "must": {
                                        "match": {
                                            "features.id": groupid
                                        }
                                    }
                                }
                            }
                        }
                    }, {
                        "nested": {
                            "path": "features",
                            "query": {
                                "bool": {
                                    "must": {
                                        "match": {
                                            "features.name": groupname
                                        }
                                    }
                                }
                            }
                        }
                    }]
                }
            }
        }
    });
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
router.get('/games/:gameid', function(req, res, next) {
    debug('==> /games/:gameid');

    getGameById(req.params.gameid).then(function(result) {
        res.send(result);
    });
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

    getGamesByPublisher(req.params.name, req.query.size, req.query.offset).then(function(result) {
        res.header("X-Total-Count", result.hits.total);
        res.send(result);
    });
});

/**
    Return game with :title published by :name
*/
router.get('/publishers/:name/games/:title', function(req, res, next) {
    debug('==> /publishers/:name/games/:title');

    getGameByPublisherAndName(req.params.name, req.params.title).then(function(result) {
        res.send(result.hits.hits[0]);
    });
});

/**
    Return games with groupid and groupname
*/
router.get('/group/:groupid/:groupname/games', function(req, res, next) {
    debug('==> /group/:groupid/:groupname/games');
    getGamesByGroup(req.params.groupid, req.params.groupname, req.query.size, req.query.offset).then(function(result) {
        res.header("X-Total-Count", result.hits.total);
        res.send(result);
    });
});

module.exports = router;