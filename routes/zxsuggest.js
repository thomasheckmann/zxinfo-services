var config = require("../config.json")[process.env.NODE_ENV || "development"];
var express = require("express");
var router = express.Router();

var elasticsearch = require("elasticsearch");
var debug = require("debug")("zxinfo-services:suggest");

var elasticClient = new elasticsearch.Client({
  host: config.es_host,
  apiVersion: config.es_apiVersion,
  log: config.es_log,
});

var es_index = config.zxinfo_index;

var maxResult = 20;

var getSuggestions = function (query) {
  return elasticClient.search({
    index: es_index,
    body: {
      _source: ["fulltitle", "contenttype", "metadata_author"],
      suggest: {
        text: query,
        titles: {
          completion: {
            field: "titlesuggest",
            skip_duplicates: true,
            size: 8,
          },
        },
        authors: {
          completion: {
            field: "authorsuggest",
            skip_duplicates: true,
            size: 8,
          },
        },
      },
    },
  });
};

var prepareSuggestions = function (result) {
  function uniq(a, param) {
    return a.filter(function (item, pos, array) {
      return (
        array
          .map(function (mapItem) {
            return mapItem[param];
          })
          .indexOf(item[param]) === pos
      );
    });
  }

  var suggestons = [];

  // iterate titles
  var i = 0;
  for (; i < result.suggest.titles[0].options.length; i++) {
    var item = {
      text: result.suggest.titles[0].options[i]._source.fulltitle,
      type: result.suggest.titles[0].options[i]._source.contenttype,
      entry_id: result.suggest.titles[0].options[i]._id,
    };
    suggestons.push(item);
  }

  // iterate authors
  var aut_suggestions = [];
  var j = 0;
  for (; j < result.suggest.authors[0].options.length; j++) {
    var names = result.suggest.authors[0].options[j]._source.metadata_author;
    var text = result.suggest.authors[0].options[j].text;

    var output = text;
    var t = 0;
    for (; t < names.length; t++) {
      if (names[t].alias.indexOf(text) > -1) {
        output = names[t].name;
      }
    }
    var item = { text: output, type: "AUTHOR" };
    aut_suggestions.push(item);
  }
  // sort
  suggestons.sort(function (a, b) {
    return a.output - b.output;
  });
  aut_suggestions = uniq(aut_suggestions, "text");

  suggestons.push.apply(suggestons, aut_suggestions);

  // sort
  suggestons.sort(function (a, b) {
    return a.output - b.output;
  });

  return suggestons;
};

/*

curl -XPOST "https://search.zxinfo.dk/zxinfo_games/_search" -H 'Content-Type: application/json' -d'
{
   "_source":[
      "metadata_author"
   ],
   "suggest":{
      "text":"olav",
      "authors":{
         "completion":{
            "field":"authorsuggest",
            "skip_duplicates":true,
            "size":10
         }
      }
   }
}'|json_pp

*/
var getAuthorSuggestions = function (name) {
  return elasticClient.search({
    index: es_index,
    body: {
      _source: ["metadata_author"], // only return this section
      suggest: {
        text: name,
        authors: {
          completion: {
            field: "authorsuggest",
            skip_duplicates: true,
            size: 10,
          },
        },
      },
    },
  });
};

var prepareAuthorSuggestions = function (result) {
  var suggestons = [];

  function uniq(a, param) {
    return a.filter(function (item, pos, array) {
      return (
        array
          .map(function (mapItem) {
            return mapItem[param];
          })
          .indexOf(item[param]) === pos
      );
    });
  }
  // iterate authors
  var suggestons = [];
  var j = 0;
  for (; j < result.suggest.authors[0].options.length; j++) {
    var names = result.suggest.authors[0].options[j]._source.metadata_author;
    var text = result.suggest.authors[0].options[j].text;

    var output = text;
    var t = 0;

    for (; t < names.length; t++) {
      if (names[t].alias.indexOf(text) > -1) {
        output = names[t].name;
      }
    }
    var item = { text: output, type: "AUTHOR" };
    suggestons.push(item);
  }
  // sort
  suggestons.sort(function (a, b) {
    return a.output - b.output;
  });
  suggestons = uniq(suggestons, "text");

  return suggestons;
};

var getPublisherSuggestions = function (name) {
  return elasticClient.search({
    index: es_index,
    body: {
      _source: ["metadata_publisher"], // only return this section
      suggest: {
        text: name,
        publishers: {
          completion: {
            field: "publishersuggest",
            skip_duplicates: false,
            size: 10,
          },
        },
      },
    },
  });
};

var preparePublisherSuggestions = function (result) {
  var suggestons = [];
  function uniq(a, param) {
    return a.filter(function (item, pos, array) {
      return (
        array
          .map(function (mapItem) {
            return mapItem[param];
          })
          .indexOf(item[param]) === pos
      );
    });
  }
  // iterate publishers
  var suggestons = [];
  var j = 0;
  for (; j < result.suggest.publishers[0].options.length; j++) {
    var names = result.suggest.publishers[0].options[j]._source.metadata_publisher;
    var text = result.suggest.publishers[0].options[j].text;
    var name = text;
    var labeltype;
    var t = 0;

    console.log(text);
    for (; t < names.length; t++) {
      if (names[t].suggest.indexOf(text) > -1) {
        name = names[t].name;
        labeltype = names[t].labeltype == null ? "" : names[t].labeltype;
      }
    }
    var item = { text: name, labeltype: labeltype };
    suggestons.push(item);
  }
  // sort
  suggestons.sort(function (a, b) {
    return a.output - b.output;
  });
  suggestons = uniq(suggestons, "text");

  return suggestons;
};
/*******************************************
 * ROUTES - ENDPOINTS
 *******************************************/

// middleware to use for all requests
router.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  // do logging
  next(); // make sure we go to the next routes and don't stop here
});

/* GET title suggestions for completion (all) */
router.get("/:query", function (req, res, next) {
  var suggestions = null;
  getSuggestions(req.params.query).then(function (result) {
    res.send(prepareSuggestions(result));
    //res.send(result);
  });
});

/* GET suggestions for AUTHOR names */
router.get("/author/:name", function (req, res, next) {
  var suggestions = null;
  getAuthorSuggestions(req.params.name).then(function (result) {
    res.send(prepareAuthorSuggestions(result));
    //res.send(result);
  });
});

/* GET suggestions for PUBLISHER names */
router.get("/publisher/:name", function (req, res, next) {
  var suggestions = null;
  getPublisherSuggestions(req.params.name).then(function (result) {
    res.send(preparePublisherSuggestions(result));
    //res.send(result);
  });
});

module.exports = router;
