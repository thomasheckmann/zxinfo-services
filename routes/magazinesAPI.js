/**

List all magazines - /magazines
Info about a magazine - /magazines/<name>
List issues for a magazine - /magazines/<name>/issues

Info about an issue - /magazines/<name>/issues/<issue>
List pages for a magazine / issue - /magazines/<name>/issues/<issue>/pages

NODE_ENV=development DEBUG=zxinfo-services:* PORT=8300 nodemon --ignore public/javascripts/config.js
*/
'use strict';

var config = require('../config.json')[process.env.NODE_ENV || 'development'];
var express = require('express');
var router = express.Router();

var elasticsearch = require('elasticsearch');
var debug = require('debug')('zxinfo-services:magazinesAPI');

var elasticClient = new elasticsearch.Client({
    host: config.es_host,
    apiVersion: config.es_apiVersion,
    log: config.es_log
});

var es_index = config.zxinfo_magazines_index;

var getSortObject = function(sort_mode) {
    var sort_object;

    if (sort_mode === 'name_asc') {
        sort_object = [{
            "name.raw": {
                "order": "asc"
            }
        }];
    } else if (sort_mode === 'name_desc') {
        sort_object = [{
            "name.raw": {
                "order": "desc"
            }
        }];
    }
    return sort_object;
}

var getAllMagazines = function(page_size, offset, sort) {
    debug('getAllMagazines()');

    var sort_mode = sort == undefined ? "date_desc" : sort;
    var sort_object = getSortObject(sort_mode);

    return elasticClient.search({
        "index": es_index,
        "body": {
            "size": page_size,
            "from": offset * page_size,
            "_source": ["name", "is_electronic", "language"],
            "query": {
                "bool": {
                    "must": [{
                        "match_all": {}
                    }]
                }
            },
            "sort": sort_object
        }
    })
};

var getMagazines = function(query, page_size, offset, sort) {
    debug('getMagazines()');

    var sort_mode = sort == undefined ? "date_desc" : sort;
    var sort_object = getSortObject(sort_mode);

    return elasticClient.search({
        "index": es_index,
        "body": {
            "size": page_size,
            "from": offset * page_size,
            "_source": {
                "includes": ["*"],
                "excludes": ["issues.*"]
            },
              "query": {
                "bool": {
                  "must": [
                    {
                      "match": {
                        "name": query
                      }
                    }
                  ]
                }
              }
        }
    })
};

var getMagazineById = function(magazineid) {
    debug('getMagazineById(' + magazineid + ')');
    return elasticClient.get({
        "index": es_index,
        "type": es_index,
        "id": magazineid
    });
}

var getMagazineByName = function(name) {
    debug('getMagazineByName(' + name + ')');
    return elasticClient.search({
        "index": es_index,
        "body": {
            "query": {
                "bool": {
                    "must": [{
                        "match": {
                            "name": name
                        }
                    }]
                }
            }
        }
    })
};

var getIssuesByMagazineName = function(name) {
    debug('getIssuesByMagazineName()');

    return elasticClient.search({
        "index": es_index,
        "body": {
            "_source": {
                "includes": ["*"],
                "excludes": ["issues.files.*", "issues.references.*"]
            },
            "size": 1,
            "from": 0,
            "query": {
                "bool": {
                    "must": [{
                        "match": {
                            "name": name
                        }
                    }]
                }
            }
        }
    })
};

var getIssue = function(name, issueid) {
    debug('getIssue()');

    return elasticClient.search({
        "index": es_index,
        "body": {
            "_source": {
                "includes": ["*"]
            },
            "size": 1,
            "from": 0,
            "query": {
                "bool": {
                    "must": [{
                            "match": {
                                "name": name
                            }
                        },
                        {
                            "nested": {
                                "path": "issues",
                                "query": {
                                    "bool": {
                                        "must": [{
                                            "term": {
                                                "issues.id": issueid
                                            }
                                        }]
                                    }
                                }
                            }
                        }
                    ]
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

/*****************************************************************************

API Methods

*****************************************************************************/


/**
    Return all magazines
*/
router.get('/', function(req, res, next) {
    debug('==> /magazines/');

    getAllMagazines(req.query.size, req.query.offset, req.query.sort).then(function(result) {
        res.header("X-Total-Count", result.hits.total);
        res.send(result);
    });
});

/**
    Search for a magazine
*/
router.get('/search/:name', function(req, res, next) {
    debug('==> /magazines/search');

    getMagazines(req.params.name, req.query.size, req.query.offset, req.query.sort).then(function(result) {
        res.header("X-Total-Count", result.hits.total);
        res.send(result);
    });
});

/**
    Return magazine with :name
*/
router.get('/:name', function(req, res, next) {
    debug('==> /magazines/:name');

    getMagazineByName(req.params.name).then(function(result) {
        if (result.hits.hits.length == 0) {
            debug('NOT FOUND: ', req.params.name);
            res.status(404).end();
        } else {
            var _source = result.hits.hits[0];
            res.send(_source);
        }
    });
});

/**
    Return issues for magazine with :name
*/
router.get('/:name/issues', function(req, res, next) {
    debug('==> /magazines/:name/issues');

    getIssuesByMagazineName(req.params.name).then(function(result) {
        if (result.hits.hits.length == 0) {
            debug('NOT FOUND: ', req.params.name);
            res.status(404).end();
        } else {
            var _source = result.hits.hits[0]._source;
            if(_source.issues === undefined) {
                _source.issues = [];
            }
            debug("X-Total-Count", _source.issues.length);
            res.header("X-Total-Count", _source.issues.length);
            res.send(_source);
        }
    });

});

/**
    Return issue for magazine with :name and issueid
*/
router.get('/:name/issues/:issueid', function(req, res, next) {
    debug('==> /magazines/:name/issues/:issueid');

    getIssue(req.params.name, req.params.issueid).then(function(result) {
        if (result.hits.hits.length == 0) {
            debug('NOT FOUND: ', req.params.name, req.params.issueid);
            res.status(404).end();
        } else {
            var _source = result.hits.hits[0]._source;

            function getIssueById(id) {
                return _source.issues.filter(
                    function(data) { return data.id == id }
                );
            }

            var found = getIssueById(req.params.issueid)[0];
            res.send({id: req.params.issueid, name: _source.name, link_mask: _source.link_mask, archive_mask: _source.archive_mask, issue: found});
        }
    });

});

/**
    Return references issue for magazine with :name and issueid
*/
router.get('/:name/issues/:issueid/references', function(req, res, next) {
    debug('==> /magazines/:name/issues/:issueid');

    getIssue(req.params.name, req.params.issueid).then(function(result) {
        if (result.hits.hits.length == 0) {
            debug('NOT FOUND: ', req.params.name, req.params.issueid);
            res.status(404).end();
        } else {
            var _source = result.hits.hits[0]._source;

            function getIssueById(id) {
                return _source.issues.filter(
                    function(data) { return data.id == id }
                );
            }

            var found = getIssueById(req.params.issueid)[0].references;
            res.header("X-Total-Count", found.length);
            res.send({id: req.params.issueid, name: _source.name, link_mask: _source.link_mask, archive_mask: _source.archive_mask, references: found});
        }
    });

});

/**
    Return files issue for magazine with :name and issueid
*/
router.get('/:name/issues/:issueid/files', function(req, res, next) {
    debug('==> /magazines/:name/issues/:issueid');

    getIssue(req.params.name, req.params.issueid).then(function(result) {
        if (result.hits.hits.length == 0) {
            debug('NOT FOUND: ', req.params.name, req.params.issueid);
            res.status(404).end();
        } else {
            var _source = result.hits.hits[0]._source;

            function getIssueById(id) {
                return _source.issues.filter(
                    function(data) { return data.id == id }
                );
            }

            var found = getIssueById(req.params.issueid)[0].files;
            res.header("X-Total-Count", found.length);
            res.send({id: req.params.issueid, name: _source.name, link_mask: _source.link_mask, archive_mask: _source.archive_mask, files: found});
        }
    });

});

module.exports = router;