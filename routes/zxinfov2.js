/**

dd.mm.yyyy

Changelog:
30.11.2017 - author object changed from simple string, to object {name, country, alias} - name & alias is searched

*/

'use strict';

var config = require('../config.json')[process.env.NODE_ENV || 'development'];
var express = require('express');
var router = express.Router();

var elasticsearch = require('elasticsearch');
var debug = require('debug')('zxinfo-services:apiv2');

var elasticClient = new elasticsearch.Client({
    host: config.es_host,
    apiVersion: config.es_apiVersion,
    log: config.log
});

var es_index = config.zxinfo_index;
var es_index_type = config.zxinfo_type;

var createQueryTem = function(query) {
    if (query == undefined || query.length == 0) {
        debug("empty query, return all");
        return ({ "match_all": {} });
    }

    return ({
        "bool": {
            "should": [{
                "multi_match": {
                    "query": query,
                    "fields": [
                        "fulltitle^4",
                        "alsoknownas"
                    ],
                    "type": "phrase_prefix",
                    "boost": 4
                }
            }, {
                "nested": {
                    "path": "releases",
                    "query": {
                        "bool": {
                            "must": [{
                                "match_phrase_prefix": {
                                    "releases.as_title": query
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
                                "match_phrase_prefix": {
                                    "publisher.name": query
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
                                "match_phrase_prefix": {
                                    "releases.name": query
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
                    "path": "authors.authors",
                    "query": {
                        "bool": {
                            "must": [{
                                "match_phrase_prefix": {
                                    "authors.authors.name": {
                                        "query": query,
                                        "boost": 3
                                    }
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
                                "match_phrase_prefix": {
                                    "authors.authors.alias": {
                                        "query": query,
                                        "boost": 3
                                    }
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
                                "match_phrase_prefix": {
                                    "authors.group": query
                                }
                            }]
                        }
                    }
                }
            }]
        }
    });
}

var createFilterItem = function(filterName, filterValues) {
    var item_should = {};

    if (filterValues !== undefined && filterValues.length > 0) {
        if (!Array.isArray(filterValues)) {
            filterValues = [filterValues];
        }
        var i = 0;
        var should = [];
        for (; i < filterValues.length; i++) {
            var item = {
                match: {
                    [filterName]: filterValues[i]
                }
            };
            should.push(item);
        }

        item_should = { bool: { should: should } };
    }
    return item_should;
}

var createFilterNestedItem = function(filterName, path, filterValues) {
    var item_should = {};

    if (filterValues !== undefined && filterValues.length > 0) {
        if (!Array.isArray(filterValues)) {
            filterValues = [filterValues];
        }
        var i = 0;
        var should = [];
        for (; i < filterValues.length; i++) {
            var item = {
                match: {
                    [filterName + '.' + path]: filterValues[i]
                }
            };
            should.push(item);
        }

        item_should = { bool: { should: [{ nested: { path: filterName, query: { bool: { should: should } } } }] } };
    }
    return item_should;
}

var createAggregationItem = function() {

}

var powerSearch = function(searchObject, page_size, offset) {
    debug('powerSearch()');
    var query = createQueryTem(searchObject.query);

    var filterObjects = {};

    var contenttype_should = createFilterItem('contenttype', searchObject.contenttype);
    filterObjects['contenttype'] = contenttype_should;

    var genretype_should = createFilterItem('type', searchObject.genretype);
    filterObjects['genretype'] = genretype_should;

    var genresubtype_should = createFilterItem('subtype', searchObject.genresubtype);
    filterObjects['genresubtype'] = genresubtype_should;

    var machinetype_should = createFilterItem('machinetype', searchObject.machinetype);
    filterObjects['machinetype'] = machinetype_should;

    var controls_should = createFilterNestedItem('controls', 'control', searchObject.control);
    filterObjects['controls'] = controls_should;

    var multiplayermode_should = createFilterItem('multiplayermode', searchObject.multiplayermode);
    filterObjects['multiplayermode'] = multiplayermode_should;

    var multiplayertype_should = createFilterItem('multiplayertype', searchObject.multiplayertype);
    filterObjects['multiplayertype'] = multiplayertype_should;

    var originalpublication_should = createFilterItem('originalpublication', searchObject.originalpublication);
    filterObjects['originalpublication'] = originalpublication_should;

    var availability_should = createFilterItem('availability', searchObject.availability);
    filterObjects['availability'] = availability_should;

    // generate array with objects
    var filters = [];
    var filterNames = Object.keys(filterObjects);
    for (var i = 0; i < filterNames.length; i++) {
        var item = filterObjects[filterNames[i]];
        var itemsize = Object.keys(item).length;
        if (itemsize > 0) {
            filters.push(item);
        }
    }

    // these queries are not part of filtering options
    var fixed = [query, contenttype_should, genresubtype_should];

    return elasticClient.search({
        "index": es_index,
        "type": es_index_type,
        "body": {
            "size": page_size,
            "from": offset * page_size,
            "query": query,
            // FILTER
            "filter": {
                "bool": {
                    "must": filters
                }
            },
            "sort": [{
                "fulltitle.raw": {
                    "order": "asc"
                }
            }],
            "highlight": {
                "fields": {
                    "fulltitle": {},
                    "alsoknownas": {},
                    "releases.as_title": {},
                    "publisher.name": {},
                    "releases.name": {},
                    "authors.authors.name": {},
                    "authors.authors.alias": {},
                    "authors.group": {}
                }
            },
            "aggregations": {
                "all_entries": {
                    "global": {},
                    "aggregations": {
                        "machinetypes": {
                            "filter": {
                                "bool": {
                                    "must": [query, contenttype_should, genresubtype_should, controls_should, multiplayermode_should, multiplayertype_should, originalpublication_should, availability_should]
                                }
                            },
                            "aggregations": {
                                "filtered_machinetypes": {
                                    "terms": {
                                        "size": 0,
                                        "field": "machinetype",
                                        "order": {
                                            "_term": "desc"
                                        }
                                    }
                                }
                            }
                        },
                        "controls": {
                            "filter": {
                                "bool": {
                                    "must": [query, contenttype_should, genresubtype_should, machinetype_should, multiplayermode_should, multiplayertype_should, originalpublication_should, availability_should]
                                }
                            },
                            "aggregations": {
                                "controls": {
                                    "nested": {
                                        "path": "controls"
                                    },
                                    "aggregations": {
                                        "filtered_controls": {
                                            "terms": {
                                                "size": 0,
                                                "field": "controls.control",
                                                "order": {
                                                    "_term": "asc"
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        "multiplayermode": {
                            "filter": {
                                "bool": {
                                    "must": [query, contenttype_should, genresubtype_should, machinetype_should, controls_should, multiplayertype_should, availability_should, originalpublication_should]
                                }
                            },
                            "aggregations": {
                                "filtered_multiplayermode": {
                                    "terms": {
                                        "size": 0,
                                        "field": "multiplayermode",
                                        "order": {
                                            "_term": "asc"
                                        }
                                    }
                                }
                            }
                        },
                        "multiplayertype": {
                            "filter": {
                                "bool": {
                                    "must": [query, contenttype_should, genresubtype_should, machinetype_should, controls_should, multiplayermode_should, availability_should, originalpublication_should]
                                }
                            },
                            "aggregations": {
                                "filtered_multiplayertype": {
                                    "terms": {
                                        "size": 0,
                                        "field": "multiplayertype",
                                        "order": {
                                            "_term": "asc"
                                        }
                                    }
                                }
                            }
                        },
                        "originalpublication": {
                            "filter": {
                                "bool": {
                                    "must": [query, contenttype_should, genresubtype_should, machinetype_should, controls_should, multiplayermode_should, multiplayertype_should, availability_should]
                                }
                            },
                            "aggregations": {
                                "filtered_originalpublication": {
                                    "terms": {
                                        "size": 0,
                                        "field": "originalpublication",
                                        "order": {
                                            "_term": "asc"
                                        }
                                    }
                                }
                            }
                        },
                        "availability": {
                            "filter": {
                                "bool": {
                                    "must": [query, contenttype_should, genresubtype_should, machinetype_should, controls_should, multiplayermode_should, multiplayertype_should, originalpublication_should]
                                }
                            },
                            "aggregations": {
                                "filtered_availability": {
                                    "terms": {
                                        "size": 0,
                                        "field": "availability",
                                        "order": {
                                            "_term": "asc"
                                        }
                                    }
                                }
                            }
                        }
                        /** insert new here */
                    }
                }
            }
        } // end body
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


*/
router.get('/search', function(req, res, next) {
    debug('==> /search');
    powerSearch(req.query, req.query.size, req.query.offset).then(function(result) {
        res.header("X-Total-Count", result.hits.total);
        res.send(result);
    });
});

module.exports = router;