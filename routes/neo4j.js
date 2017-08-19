/**

    http://localhost:3000/api/path/William%20J.%20Wray/Matthew%20Smith

*/

var config = require('../config.json')[process.env.NODE_ENV || 'development'];
var express = require('express');
var router = express.Router();
var debug = require('debug')('zxinfo-graph:neo4j');

var neo4j = require('neo4j-driver').v1;
var driver = neo4j.driver(config.neo4jurl, neo4j.auth.basic('', ''));

function processStep(section, level) {
    var arr = [];

    var startType = section.start.labels[0];
    var endType = section.end.labels[0];
    var relationType = section.relationship.type;

    debug(startType + " -> " + endType + " ("+relationType+")");

    if (relationType == 'WRITTEN_BY') {
        if (startType == 'Author') {
            arr.push({ type: startType, name: section.start.properties.name });
            arr.push({ relationtype: relationType, text: 'wrote', level: level, item: endType });
        } else {
            arr.push({ type: startType, title: section.start.properties.title, id:section.start.properties.id.low});
            arr.push({ relationtype: relationType, text: 'was written by', level: level });
        }
    } else if (relationType == 'PUBLISHED_BY') {
        if (startType == 'Publisher') {
            arr.push({ type: startType, name: section.start.properties.name });
            arr.push({ relationtype: relationType, text: 'also published', level: level, item: endType });
        } else {
            arr.push({ type: startType, title: section.start.properties.title, id:section.start.properties.id.low });
            arr.push({ relationtype: relationType, text: 'was published by', level: level });
        }
    } else if (relationType == 'RE_RELEASED_BY') {
        if (startType == 'Publisher') {
            arr.push({ type: startType, name: section.start.properties.name });
            arr.push({ relationtype: relationType, text: 'also re-relased', level: level, item: endType });
        } else {
            // Entry-PUBLISHED_BY->Publisher (Entry 'was published by' Publisher)
            // console.log(section.start.properties.title + " was published by " + section.end.properties.name);
            arr.push({ type: startType, title: section.start.properties.title, id:section.start.properties.id.low });
            arr.push({ relationtype: relationType, text: 'was re-relased by', level: level, item: endType });
        }
    } else if (relationType == 'PART_OF_COMPILATION') {
            debug(section.start.properties);
        if (startType == 'Compilation') {
            arr.push({ type: startType, title: section.start.properties.title, id:section.start.properties.id.low });
            arr.push({ relationtype: relationType, text: 'contains', level: level, item: endType });
        } else {
            arr.push({ type: startType, title: section.start.properties.title, id:section.start.properties.id.low });
            arr.push({ relationtype: relationType, text: 'is part of compilation', level: level, item: endType });
        }
    } else if (relationType == 'INSPIRED_BY') {
        if (startType == 'Inspiration') {
            arr.push({ type: startType, name: section.start.properties.name, inspirationtype: section.start.properties.type });
            arr.push({ relationtype: relationType, text: 'was inspiration for', level: level, item: endType });
        } else {
            arr.push({ type: startType, title: section.start.properties.title, id:section.start.properties.id.low });
            arr.push({ relationtype: relationType, text: 'was inspired by', level: level, item: section.end.properties.type });
        }
    } else if (relationType == 'MAJOR_CLONE_OF') {
        if (startType == 'Video_game') {
            arr.push({ type: startType, name: section.start.properties.name, url: section.start.properties.url });
            arr.push({ relationtype: relationType, text: 'was cloned by', level: level, item: endType });
        } else {
            arr.push({ type: startType, title: section.start.properties.title, id:section.start.properties.id.low });
            arr.push({ relationtype: relationType, text: 'is a clone of', level: level, item: section.end.properties.type });
        }
    } else {
        console.log('UNKNOWN: ' + relationType);
    }

    return arr;
}

/**
[


]


*/
function parsePath(p) {
    var path, pathinfo;
    var result = [];

    path = p.get('p');
    pathinfo = path.segments;
    // console.log(path);
    pathinfo.forEach(function(currentValue, index, array) {
        if (index < array.length - 1) {
            result = result.concat(processStep(currentValue, index + 1));
        } else {
            result = result.concat(processStep(currentValue, index + 1));
            result = result.concat([{ type: 'Author', name: currentValue.end.properties.name }]);
        }
    })

    // Add endNode (Author)
    return result;
}

var getShortestPath = function(fromNode, toNode, allEntries, incReReleases, incAllSteps) {
    var queryRelations = ':INSPIRED_BY|PART_OF_COMPILATION|WRITTEN_BY|PUBLISHED_BY|MAJOR_CLONE_OF';
    if(incReReleases == 1) {
        queryRelations += '|RE_RELEASED_BY';
        debug('include Re-Releases, Yes');
    }

    var queryEntries = 'WHERE ALL(x IN nodes(p)[1..-1] WHERE (x:Game OR x:Compilation OR x:Author OR x:Book OR x:Inspiration OR x:Video_game OR x:Publisher))';
    if(allEntries == 1) {
        // queryEntries = 'WHERE ALL(x IN nodes(p)[1..-1] WHERE (x:Game OR x:Compilation OR x:Book OR x:Demo OR x:Misc OR x:Utility OR x:Hardware))'
        queryEntries = '';
        debug('include all entries, Yes');
    }

    var querySteps = '1..6';
    if(incAllSteps == 1) {
        querySteps = '';
    };
    var session = driver.session();
    return session
        .run(
            'MATCH p=shortestPath((a1:Author {name: {fromName} })-['+queryRelations+'*'+querySteps+']-(a2:Author{name: {toName} })) '+queryEntries+' RETURN p', { fromName: fromNode, toName: toNode }
        )
        .then(function(result) {
            session.close();
            // shortestPath only returns one PATH
            if (result.records.length > 0) {
                return parsePath(result.records[0]);
            } else {
                return [];
            };
        })
        .catch(function(error) {
            console.log(error);
        });
}

router.get('/', function(req, res, next) {
    res.send('respond with a resource');
});

router.get('/path/:startName/:endName', function(req, res, next) {
    debug('[PATH], from=' + req.params.startName + ", to=" + req.params.endName);
    debug('includeAll: '+req.query.includeall);
    debug('includeReReleases:'+req.query.includerereleases);
    debug('includeAllSteps:'+req.query.includeallsteps);

    getShortestPath(req.params.startName, req.params.endName, req.query.includeall, req.query.includerereleases, req.query.includeallsteps).then(function(result) {
        res.send({ result });
    });
});

module.exports = router;
