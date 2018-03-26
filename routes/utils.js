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
        }];
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
        }];
    }
    return sort_object;
}

var removeEmpty = function(item) {
    for (var property in item) {
        if (item.hasOwnProperty(property)) {
            var value = item[property];
            if (value === undefined || value === null || value.length === 0 ||  (Object.keys(value).length === 0) && value.constructor === Object) {
                delete item[property];
            }
        }
    }

    return item;
}

var zxdbResultSingle = function(r, mode) {
    mode = mode == undefined ? "compact" : mode;
    debug('mode=' + mode);

    if (mode === 'full') {
        return r;
    }

    var source = r._source;
    delete r._source;

    r._source = {};
    r._source.fulltitle = source.fulltitle;
    r._source.yearofrelease = source.yearofrelease;
    r._source.monthofrelease = source.monthofrelease;
    r._source.dayofrelease = source.dayofrelease;
    r._source.machinetype = source.machinetype;
    r._source.numberofplayers = source.numberofplayers;
    r._source.multiplayermode = source.multiplayermode;
    r._source.multiplayertype = source.multiplayertype;
    r._source.type = source.type;
    r._source.subtype = source.subtype;
    r._source.isbn = source.isbn;
    r._source.messagelanguage = source.messagelanguage;
    r._source.originalprice = source.originalprice;
    r._source.availability = source.availability;
    r._source.knownerrors = source.knownerrors;
    r._source.remarks = source.remarks;
    r._source.spotcomments = source.spotcomments;
    r._source.score = source.score;
    r._source.publisher = source.publisher;
    r._source.releases = source.releases;
    r._source.authors = source.authors;
    r._source.roles = source.roles;
    r._source.authored = source.authored;
    r._source.authoring = source.authoring;
    r._source.controls = source.controls;
    r._source.series = source.series;
    r._source.othersystems = source.othersystems;
    r._source.contents = source.contents;
    r._source.screens = source.screens;
    r._source.incompilations = source.incompilations;
    r._source.booktypeins = source.booktypeins;
    r._source.additionals = source.additionals;
    r._source.mod_of = source.mod_of;
    r._source.modified_by = source.modified_by;


    r._source = removeEmpty(r._source);

    return r;
}

var zxdbResultList = function(r, mode) {
    mode = mode == undefined ? "compact" : mode;
    debug('mode=' + mode);

    if (mode === 'full') {
        return r;
    }
    var hitsIn = r.hits.hits;
    delete r.hits.hits;
    delete r.aggregations;

    // compact hits
    var i = 0;
    var hitsOut = [];
    for (; i < hitsIn.length; i++) {
        var item = hitsIn[i];
        var source = hitsIn[i]._source;
        delete item._source;
        delete item.highlight;
        delete item.sort;

        item.fulltitle = source.fulltitle;
        item.yearofrelease = source.yearofrelease;
        item.monthofrelease = source.monthofrelease;
        item.dayofrelease = source.dayofrelease;
        item.type = source.type;
        item.subtype = source.subtype;
        item.authors = source.authors;
        item.publisher = source.publisher;
        item.machinetype = source.machinetype;
	    item.availability = source.availability;

        // remove "empty"
        item = removeEmpty(item);

        hitsOut.push(item);
    }


    r.hits.hits = hitsOut;
    return r;
}


module.exports = {
    zxdbResultList: zxdbResultList,
    zxdbResultSingle: zxdbResultSingle,
    getSortObject: getSortObject
};