var config = require('../config.json')[process.env.NODE_ENV || 'development'];
var express = require('express');
var router = express.Router();

var elasticsearch = require('elasticsearch');

var elasticClient = new elasticsearch.Client({
    host: config.es_host,
    log: config.log
});

var es_index = config.zxinfo_index;
var es_index_type = config.zxinfo_type;

/**

    search for games
    matches against: fulltitle, alsoknown as and rereleased as title
*/
var searchGame = function(query, page_size, offset) {
    return elasticClient.search({
        "index": es_index,
        "type": es_index_type,
        "body": {
            "size": page_size,
            "from": offset * page_size,
            "query": {
                "bool": {
                    "should": [{
                        "multi_match": {
                            "query": query,
                            "fields": [
                                "fulltitle^4",
                                "alsoknownas"
                            ],
                            "boost": 4
                        }
                    }, {
                        "nested": {
                            "path": "rereleasedby",
                            "query": {
                                "bool": {
                                    "must": [{
                                        "match": {
                                            "rereleasedby.as_title": query
                                        }
                                    }],
                                    "must_not": [{
                                        "match": {
                                            "seq": 0
                                        }
                                    }]
                                }
                            }
                        }
                    }, {
                        "nested": {
                            "path": "publisher",
                            "query": {
                                "bool": {
                                    "must": [{
                                        "match": {
                                            "publisher.name": query
                                        }
                                    }]
                                }
                            }
                        }
                    }, {
                        "nested": {
                            "path": "rereleasedby",
                            "query": {
                                "bool": {
                                    "must": [{
                                        "match": {
                                            "rereleasedby.name": query
                                        }
                                    }]
                                },
                                "must_not": [{
                                    "match": {
                                        "seq": 0
                                    }
                                }]
                            }
                        }
                    }, {
                        "nested": {
                            "path": "authors",
                            "query": {
                                "bool": {
                                    "must": [{
                                        "match": {
                                            "authors.authors": {"query": query, "boost": 3}
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
                                            "authors.group": query
                                        }
                                    }]
                                }
                            }
                        }
                    }]
                }
            },
            "highlight": {
                "fields": {
                    "fulltitle": {},
                    "alsoknownas": {},
                    "rereleasedby.as_title": {},
                    "publisher.name": {},
                    "rereleasedby.name": {},
                    "authors.authors": {},
                    "authors.group": {}
                }
            }

        }
    });
}

var getAllGames = function(page_size, offset) {
    return elasticClient.search({
        "index": es_index,
        "type": es_index_type,
        "body": {
            "size": page_size,
            "from": offset * page_size,
            "query": {
                "match_all": {}
            },
            "sort": [{
                "_uid": {
                    "order": "asc"
                }
            }]
        }
    });
}

var getAllGamesByTypes = function(gametypes, gamesubtypes, page_size, offset) {
    var match = [{
        "match": {
            "type": gametypes
        }
    }];

    if (gamesubtypes !== undefined) {
        match.push({
            "match": {
                "subtype": gamesubtypes
            }
        });
    }

    return elasticClient.search({
        "index": es_index,
        "type": es_index_type,
        "body": {
            "size": page_size,
            "from": offset * page_size,
            "query": {
                "match_all": {}
            },
            "filter": {
                "bool": {
                    "must": [match]
                }
            },
            "sort": [{
                "fulltitle.raw": {
                    "order": "asc"
                }
            }]
        }
    });
}

var getAllGamesByMachines = function(machinetypes, page_size, offset) {
    return elasticClient.search({
        "index": es_index,
        "type": es_index_type,
        "body": {
            "size": page_size,
            "from": offset * page_size,
            "query": {
                "match_all": {}
            },
            "filter": {
                "bool": {
                    "must": [{
                        "match": {
                            "machinetype": machinetypes
                        }
                    }]
                }
            },
            "sort": [{
                "fulltitle.raw": {
                    "order": "asc"
                }
            }]
        }
    });
}

var getGameById = function(gameid) {
    return elasticClient.get({
        "index": es_index,
        "type": es_index_type,
        "id": gameid
    });
}

var getGamesByPublisher = function(name, page_size, offset) {
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
                                    "path": "rereleasedby",
                                    "query": {
                                        "bool": {
                                            "must": [{
                                                "match": {
                                                    "rereleasedby.name.raw": name
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
                                    "path": "authors",
                                    "query": {
                                        "bool": {
                                            "must": [{
                                                "match": {
                                                    "authors.authors.raw": name
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
    console.log("user-agent: " + req.headers['user-agent']);
    next(); // make sure we go to the next routes and don't stop here
});

/**
    Return a list of games matching :query
    The following fields are queried:
    * fulltitle
    * alsoknownas
    * re-released as title

*/
router.get('/games/search/:query', function(req, res, next) {
    searchGame(req.params.query, req.query.size, req.query.offset).then(function(result) {
        res.header("X-Total-Count", result.hits.total);
        res.send(result);
    });
});

/**
    Return all games sorted by gameid (WOSId)
*/
router.get('/games', function(req, res, next) {
    if (req.query.types !== undefined) {
        getAllGamesByTypes(req.query.types, req.query.subtypes, req.query.size, req.query.offset).then(function(result) {
            res.header("X-Total-Count", result.hits.total);
            res.send(result);
        });
    } else if (req.query.machines !== undefined) {
        getAllGamesByMachines(req.query.machines, req.query.size, req.query.offset).then(function(result) {
            res.header("X-Total-Count", result.hits.total);
            res.send(result);
        });
    } else {
        getAllGames(req.query.size, req.query.offset).then(function(result) {
            res.header("X-Total-Count", result.hits.total);
            res.send(result);
        });
    }
});

/**
    Return game with :gameid
*/
router.get('/games/:gameid', function(req, res, next) {
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
    getGamesByPublisher(req.params.name, req.query.size, req.query.offset).then(function(result) {
        res.header("X-Total-Count", result.hits.total);
        res.send(result);
    });
});

/**
    Return game with :title published by :name
*/
router.get('/publishers/:name/games/:title', function(req, res, next) {
    getGameByPublisherAndName(req.params.name, req.params.title).then(function(result) {
        res.send(result.hits.hits[0]);
    });
});

/**
    Return games with groupid and groupname
*/
router.get('/group/:groupid/:groupname/games', function(req, res, next) {
    getGamesByGroup(req.params.groupid, req.params.groupname, req.query.size, req.query.offset).then(function(result) {
        res.header("X-Total-Count", result.hits.total);
        res.send(result);
    });
});

module.exports = router;
