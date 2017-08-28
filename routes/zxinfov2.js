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

var createFilterItems = function(filterName, filterValues) {
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


/**
    Nested property, eg.

    CONTROL (nested)
    -----------
    {
       "bool": {
          "should": [
             {
                "nested": {
                   "path": "controls",
                   "query": {
                      "bool": {
                         "should": [
                            {
                               "match": {
                                  "controls.control": "Cursor"
                               }
                            },
                            {
                               "match": {
                                  "controls.control": "Kempston"
                               }
                            }
                         ]
                      }
                   }
                }
             }
          ]
       }
    }
*/
var createFilterNestedItems = function(filterName, path, filterValues) {
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


var powerSearch = function(searchObject, page_size, offset) {
    var filterObjects = {};

    var machinetype_should = createFilterItems('machinetype', searchObject.machinetype);
    filterObjects['machinetype'] = machinetype_should;

    var controls_should = createFilterNestedItems('controls', 'control', searchObject.control);
    filterObjects['controls'] = controls_should;

    var multiplayermode_should = createFilterItems('multiplayermode', searchObject.multiplayermode);
    filterObjects['multiplayermode'] = multiplayermode_should;

    var multiplayertype_should = createFilterItems('multiplayertype', searchObject.multiplayertype);
    filterObjects['multiplayertype'] = multiplayertype_should;

    var originalpublication_should = createFilterItems('originalpublication', searchObject.originalpublication);
    filterObjects['originalpublication'] = originalpublication_should;

    var availability_should = createFilterItems('availability', searchObject.availability);
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

    return elasticClient.search({
        "index": es_index,
        "type": es_index_type,
        "body": {
            "size": page_size,
            "from": offset * page_size,

            "query": {
                "match_all": {}
            },
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
            "aggregations": {
                "all_entries": {
                    "global": {},
                    "aggregations": {
                        "machinetypes": {
                            "filter": {
                                "bool": {
                                    "must": [controls_should, multiplayermode_should, multiplayertype_should, originalpublication_should, availability_should]
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
                                    "must": [machinetype_should, multiplayermode_should, multiplayertype_should, originalpublication_should, availability_should]
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
                                    "must": [machinetype_should, controls_should, multiplayertype_should, availability_should, originalpublication_should]
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
                                    "must": [machinetype_should, controls_should, multiplayermode_should, availability_should, originalpublication_should]
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
                                    "must": [machinetype_should, controls_should, multiplayermode_should, multiplayertype_should, availability_should]
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
                                    "must": [machinetype_should, controls_should, multiplayermode_should, multiplayertype_should, originalpublication_should]
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
    console.log("user-agent: " + req.headers['user-agent']);
    next(); // make sure we go to the next routes and don't stop here
});

/**


*/
router.get('/search', function(req, res, next) {
    powerSearch(req.query, req.query.size, req.query.offset).then(function(result) {
        res.header("X-Total-Count", result.hits.total);
        res.send(result);
    });
});

module.exports = router;