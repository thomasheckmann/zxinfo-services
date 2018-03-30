'use strict';

var debug = require('debug')('zxinfo-services:utils');

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
            }
        ];
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
            }
        ];
    } else if (sort_mode === 'rel_asc') {
        sort_object = [{
                "_score": {
                    "order": "asc"
                }
            },
            {
                "fulltitle.raw": {
                    "order": "asc"
                }
            }
        ];
    } else if (sort_mode === 'rel_desc') {
        sort_object = [{
                "_score": {
                    "order": "desc"
                }
            },
            {
                "fulltitle.raw": {
                    "order": "asc"
                }
            }
        ];
    }
    return sort_object;
}

var es_source_item = function(outputmode) {
    if (outputmode == 'full') {
        return ["*"];
    }

    var source_includes = [
        "fulltitle",
        "yearofrelease",
        "monthofrelease",
        "dayofrelease",
        "machinetype",
        "numberofplayers",
        "multiplayermode",
        "multiplayertype",
        "type",
        "subtype",
        "isbn",
        "messagelanguage",
        "originalprice",
        "availability",
        "knownerrors",
        "remarks",
        "spotcomments",
        "score",
        "publisher",
        "releases",
        "authors",
        "roles",
        "authored",
        "authoring",
        "controls",
        "series",
        "othersystems",
        "contents",
        "screens",
        "incompilations",
        "booktypeins",
        "additionals",
        "mod_of",
        "modified_by"
    ];
    return source_includes;
}

var es_source_list = function(outputmode) {
    if (outputmode == 'full') {
        return ["*"];
    }

    var source_includes = [
        "fulltitle",
        "yearofrelease",
        "monthofrelease",
        "dayofrelease",
        "type",
        "subtype",
        "authors",
        "publisher",
        "machinetype",
        "availability"
    ];

    return source_includes;
}

module.exports = {
    es_source_item: es_source_item,
    es_source_list: es_source_list,
    getSortObject: getSortObject
};