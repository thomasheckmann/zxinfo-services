/**

dd.mm.yyyy

Changelog:
17.01.2018 - Elasticsearch upgrade from 2.4.x -> 6.1.x (Lots of API & Query changes)
           - npm elastisearch upgraded to latest
           - npm debug opgraded to latest
30.11.2017 - author object changed from simple string, to object {name, country, alias} - name & alias is searched

To RUN with debug info:
DEBUG=zxinfo-services:* NODE_ENV=development PORT=8300 nodemon --ignore public/javascripts/config.js

*/

'use strict';

var tools = require('./utils');

var config = require('../config.json')[process.env.NODE_ENV || 'development'];
var express = require('express');
var router = express.Router();

var elasticsearch = require('elasticsearch');
var debug = require('debug')('zxinfo-services:apiv2');

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

var queryTerm1 = {
    "match_all": {}
};

function queryTerm2(query) {
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


/**
var createQueryTerm = function(query) {
    if (query == undefined || query.length == 0) {
        debug("empty query, return all");
        return ({
            "bool": {
                "must": queryTerm1
            }
        });
    }

    return ({
        "bool": {
            "must": queryTerm2(query)
        }
    });
}
*/


var createQueryTermWithFilters = function(query, filters) {
    if (query == undefined || query.length == 0) {
        debug("empty query, return all");
        return ({
            "bool": {
                "must": queryTerm1,
                "filter": {
                    "bool": {
                        "must": filters
                    }
                }
            }
        });
    }

    return ({
        "bool": {
            "must": [queryTerm2(query)],
            "filter": {
                "bool": {
                    "must": filters
                }
            }
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

/**
 * Helper for aggregation - each aggregation should include all filters, except its own
 */
function removeFilter(filters, f) {
    const index = filters.indexOf(f);
    filters.splice(index, 1);
    return filters.filter(value => Object.keys(value).length !== 0);;
};

var powerSearch = function(searchObject, page_size, offset) {
    debug('powerSearch(): ' + JSON.stringify(searchObject));

    // title_asc, title_desc, date_asc, date_desc
    var sort_mode = searchObject.sort == undefined ? "date_desc" : searchObject.sort;
    var sort_object = getSortObject(sort_mode);

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

    var type_should = createFilterItem('type', searchObject.type);
    filterObjects['type'] = type_should;

    var language_should = createFilterItem('messagelanguage', searchObject.language);
    filterObjects['language'] = language_should;

    var year_should = createFilterItem('yearofrelease', searchObject.year);
    filterObjects['yearofrelease'] = year_should;

    /**

    -- (C)ompetition - Tron256(17819) - competition
    -- (F)eature - Lunar Jetman(9372) - features
    -- (M)ajor Clone - Gulpman(2175) - majorclone
    -- (N)amed - LED Storm(9369) - series
    -- (T)hemed - Valhalla(7152) - themedgroup
    -- (U)Unnamed - Alpha-Beth(10966) - unsortedgroup

    */

    var grouptype_id = '';

    if (searchObject.group === 'C') {
        grouptype_id = 'competition';
    } else if (searchObject.group === 'F') {
        grouptype_id = 'features';
    } else if (searchObject.group === 'M') {
        grouptype_id = 'majorclone';
    } else if (searchObject.group === 'N') {
        grouptype_id = 'series';
    } else if (searchObject.group === 'T') {
        grouptype_id = 'themedgroup';
    } else if (searchObject.group === 'U') {
        grouptype_id = 'unsortedgroup';
    }

    var groupandname_must = {};
    if (searchObject.group !== undefined && searchObject.groupname !== undefined) {
        var groupBools = [];
        groupBools.push({ "nested": { "path": grouptype_id, "query": { "bool": { "must": { "match": {
                                [grouptype_id + ".name"]: searchObject.groupname } } } } } });
        groupandname_must = { "bool": { "must": groupBools } };
        filterObjects['groupandname'] = groupandname_must;
    }

    // generate array with filter objects
    var filters = [];
    var filterNames = Object.keys(filterObjects);
    for (var i = 0; i < filterNames.length; i++) {
        var item = filterObjects[filterNames[i]];
        var itemsize = Object.keys(item).length;
        if (itemsize > 0) {
            filters.push(item);
        }
    }

    var query = createQueryTermWithFilters(searchObject.query, filters);

    var aggfilter = [query, contenttype_should, genresubtype_should, machinetype_should, controls_should, multiplayermode_should, multiplayertype_should, originalpublication_should, availability_should, type_should, language_should, year_should];


    // random X, if offset=random, size max 10
    
    var fromOffset, queryObject;

    if(offset === 'random') {
        if(page_size > 10) {
            page_size = 10;
        }
        fromOffset = 0;
        queryObject = {
            "function_score": {
                "query" : query,
                "functions": [{
                    "random_score": {}
                }]
            }
        };

        sort_object = [{
            "_score": {
                "order": "asc"
            }
        }];
    } else {
        fromOffset = offset * page_size;
        queryObject = query;
    }

    return elasticClient.search({
        "index": es_index,
        "body": {
            "track_scores": true,
            "size": page_size,
            "from": fromOffset,
            "query": queryObject,
            "sort": sort_object,
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
                                    "must": removeFilter(aggfilter, machinetype_should)
                                }
                            },
                            "aggregations": {
                                "filtered_machinetypes": {
                                    "terms": {
                                        "size": 100,
                                        "field": "machinetype",
                                        "order": {
                                            "_key": "desc"
                                        }
                                    }
                                }
                            }
                        },
                        "controls": {
                            "filter": {
                                "bool": {
                                    "must": removeFilter(aggfilter, controls_should)
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
                                                "size": 100,
                                                "field": "controls.control",
                                                "order": {
                                                    "_key": "asc"
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
                                    "must": removeFilter(aggfilter, multiplayermode_should)
                                }
                            },
                            "aggregations": {
                                "filtered_multiplayermode": {
                                    "terms": {
                                        "size": 100,
                                        "field": "multiplayermode",
                                        "order": {
                                            "_key": "asc"
                                        }
                                    }
                                }
                            }
                        },
                        "multiplayertype": {
                            "filter": {
                                "bool": {
                                    "must": removeFilter(aggfilter, multiplayertype_should)
                                }
                            },
                            "aggregations": {
                                "filtered_multiplayertype": {
                                    "terms": {
                                        "size": 100,
                                        "field": "multiplayertype",
                                        "order": {
                                            "_key": "asc"
                                        }
                                    }
                                }
                            }
                        },
                        "originalpublication": {
                            "filter": {
                                "bool": {
                                    "must": removeFilter(aggfilter, originalpublication_should)
                                }
                            },
                            "aggregations": {
                                "filtered_originalpublication": {
                                    "terms": {
                                        "size": 100,
                                        "field": "originalpublication",
                                        "order": {
                                            "_key": "asc"
                                        }
                                    }
                                }
                            }
                        },
                        "availability": {
                            "filter": {
                                "bool": {
                                    "must": removeFilter(aggfilter, availability_should)
                                }
                            },
                            "aggregations": {
                                "filtered_availability": {
                                    "terms": {
                                        "size": 100,
                                        "field": "availability",
                                        "order": {
                                            "_key": "asc"
                                        }
                                    }
                                }
                            }
                        },
                        "type": {
                            "filter": {
                                "bool": {
                                    "must": removeFilter(aggfilter, type_should)
                                }
                            },
                            "aggregations": {
                                "filtered_type": {
                                    "terms": {
                                        "size": 100,
                                        "field": "type",
                                        "order": {
                                            "_key": "asc"
                                        }
                                    }
                                }
                            }
                        },
                        "language": {
                            "filter": {
                                "bool": {
                                    "must": removeFilter(aggfilter, language_should)
                                }
                            },
                            "aggregations": {
                                "filtered_language": {
                                    "terms": {
                                        "size": 100,
                                        "field": "messagelanguage",
                                        "order": {
                                            "_key": "asc"
                                        }
                                    }
                                }
                            }
                        },
                        "year": {
                            "filter": {
                                "bool": {
                                    "must": removeFilter(aggfilter, year_should)
                                }
                            },
                            "aggregations": {
                                "filtered_year": {
                                    "terms": {
                                        "size": 100,
                                        "field": "yearofrelease",
                                        "order": {
                                            "_key": "asc"
                                        }
                                    }
                                }
                            }
                        }
                        /** insert new AGG here */
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
        res.send(tools.zxdbResultList(result, req.query.mode));
    });
});

module.exports = router;