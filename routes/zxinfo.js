"use strict";

var tools = require("./utils");

var config = require("../config.json")[process.env.NODE_ENV || "development"];
var express = require("express");
var router = express.Router();

var elasticsearch = require("elasticsearch");
var debug = require("debug")("zxinfo-services:apiv1");

var elasticClient = new elasticsearch.Client({
  host: config.es_host,
  apiVersion: config.es_apiVersion,
  log: config.es_log,
});

var es_index = config.zxinfo_index;

/**
 * Test case:
 *      - pick game from frontpage (or result page)
 *      - direct link to detail page '/details/0002259'
 *
 * Notes:
 *      - TODO: Invalid ID is not handled in any way
 */
var getGameById = function (gameid, outputmode) {
  debug("getGameById(" + gameid + ")");

  return elasticClient.get({
    _source: tools.es_source_item(outputmode),
    _source_excludes: "titlesuggest, metadata_author,authorsuggest",
    index: es_index,
    type: es_index,
    id: gameid,
  });
};

/**
 * Test case:
 *      - click publisher from result page
 *      - direct link to publisher list '/publisher/ZX-Guaranteed'
 *
 * Notes:
 *      -
 */
var getGamesByPublisher = function (name, page_size, offset, sort, outputmode) {
  debug("getGamesByPublisher()");

  var sort_mode = sort == undefined ? "date_desc" : sort;
  var sort_object = tools.getSortObject(sort_mode);

  return elasticClient.search({
    _source: tools.es_source_list(outputmode),
    _source_excludes: "titlesuggest, metadata_author,authorsuggest",
    filter_path: "-hits.hits.sort,-hits.hits.highlight,-hits.hits._explanation",
    index: es_index,
    body: {
      size: page_size,
      from: offset * page_size,
      query: {
        bool: {
          must: {
            match_all: {},
          },
          filter: {
            bool: {
              should: [
                {
                  nested: {
                    path: "publisher",
                    query: {
                      bool: {
                        must: [
                          {
                            match_phrase_prefix: {
                              "publisher.name": name,
                            },
                          },
                        ],
                      },
                    },
                  },
                },
                {
                  nested: {
                    path: "releases",
                    query: {
                      bool: {
                        must: [
                          {
                            match_phrase_prefix: {
                              "releases.publisher": name,
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      },
      sort: sort_object,
    },
  });
};

/**
 * Test case:
 *      - http://localhost:8300/api/zxinfo/publishers/Bug-Byte%20Software%20Ltd/games/Manic%20Miner
 *      - Manic Miner details -> Series -> Jet Set Willy
 *
 * Notes:
 *      -
 */
var getGameByPublisherAndName = function (name, title, outputmode) {
  debug("getGameByPublisherAndName()");

  return elasticClient.search({
    _source: tools.es_source_item(outputmode),
    _source_excludes: "titlesuggest, metadata_author,authorsuggest",
    index: es_index,
    body: {
      size: 1,
      query: {
        bool: {
          should: [
            {
              match: {
                fulltitle: title,
              },
            },
            {
              match: {
                alsoknownas: title,
              },
            },
          ],
          filter: {
            bool: {
              should: [
                {
                  nested: {
                    path: "publisher",
                    query: {
                      bool: {
                        must: [
                          {
                            match_phrase_prefix: {
                              "publisher.name": name,
                            },
                          },
                        ],
                      },
                    },
                  },
                },
                {
                  nested: {
                    path: "releases",
                    query: {
                      bool: {
                        must: [
                          {
                            match_phrase_prefix: {
                              "releases.publisher": name,
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      },
    },
  });
};

var getRandomX = function (total, outputmode) {
  debug("getRandomX()");

  if (outputmode !== "full" && outputmode !== "compact") {
    outputmode = "tiny";
  }
  return elasticClient.search({
    _source: tools.es_source_item(outputmode),
    _source_excludes: "titlesuggest, metadata_author,authorsuggest",
    index: es_index,
    body:
      //-- BODY
      {
        size: total,
        query: {
          function_score: {
            query: {
              bool: {
                must_not: [],
                must: [
                  { terms: { type: ["Adventure Game", "Arcade Game", "Casual Game", "Game", "Sport Game", "Strategy Game"] } },
                  {
                    match: {
                      contenttype: "SOFTWARE",
                    },
                  },
                ],
                should: [
                  {
                    nested: {
                      path: "screens",
                      query: {
                        bool: {
                          must: [
                            {
                              match: {
                                "screens.type": "Loading screen",
                              },
                            },
                            {
                              match: {
                                "screens.format": "Picture",
                              },
                            },
                          ],
                        },
                      },
                    },
                  },
                  {
                    nested: {
                      path: "screens",
                      query: {
                        bool: {
                          must: [
                            {
                              match: {
                                "screens.type": "Running screen",
                              },
                            },
                            {
                              match: {
                                "screens.format": "Picture",
                              },
                            },
                          ],
                        },
                      },
                    },
                  },
                ],
              },
            },
            functions: [
              {
                random_score: { seed: "" + Date.now(), field: "_seq_no" },
              },
            ],
          },
        },
      },
  });
};

var getRandomXwithVideos = function (total, outputmode) {
  debug("getRandomXwithVideos()");

  if (outputmode !== "full" && outputmode !== "compact") {
    outputmode = "tiny";
  }

  return elasticClient.search({
    _source: tools.es_source_item(outputmode),
    _source_excludes: "titlesuggest, metadata_author,authorsuggest",
    index: es_index,
    body:
      //-- BODY
      {
        size: total,
        query: {
          function_score: {
            query: {
              bool: {
                must_not: [],
                must: [
                  { exists: { field: "youtubelinks" } },
                  {
                    match: {
                      contenttype: "SOFTWARE",
                    },
                  },
                ],
                should: [
                  {
                    nested: {
                      path: "screens",
                      query: {
                        bool: {
                          must: [
                            {
                              match: {
                                "screens.type": "Loading screen",
                              },
                            },
                            {
                              match: {
                                "screens.format": "Picture",
                              },
                            },
                          ],
                        },
                      },
                    },
                  },
                  {
                    nested: {
                      path: "screens",
                      query: {
                        bool: {
                          must: [
                            {
                              match: {
                                "screens.type": "Running screen",
                              },
                            },
                            {
                              match: {
                                "screens.format": "Picture",
                              },
                            },
                          ],
                        },
                      },
                    },
                  },
                ],
                minimum_should_match: 1,
              },
            },
            functions: [
              {
                random_score: {},
              },
            ],
          },
        },
      },
  });
};

var getGamesByAuthor = function (name, page_size, offset, sort, outputmode) {
  debug("getGamesByAuthor()");

  var sort_mode = sort == undefined ? "date_desc" : sort;
  var sort_object = tools.getSortObject(sort_mode);

  return elasticClient.search({
    _source: tools.es_source_list(outputmode),
    _source_excludes: "titlesuggest, metadata_author,authorsuggest",
    filter_path: "-hits.hits.sort,-hits.hits.highlight,-hits.hits._explanation",
    index: es_index,
    body: {
      size: page_size,
      from: offset * page_size,
      query: {
        bool: {
          must: {
            match_all: {},
          },
          filter: {
            bool: {
              should: [
                {
                  nested: {
                    path: "authors",
                    query: {
                      bool: {
                        must: [
                          {
                            match: {
                              "authors.group.raw": name,
                            },
                          },
                        ],
                      },
                    },
                  },
                },
                {
                  nested: {
                    path: "authors.authors",
                    query: {
                      bool: {
                        must: [
                          {
                            match: {
                              "authors.authors.name.raw": name,
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      },
      sort: sort_object,
    },
  });
};

var getGamesByAuthorAndTitle = function (name, title, outputmode) {
  debug("getGamesByAuthorAndTitle()");

  return elasticClient.search({
    _source: tools.es_source_item(outputmode),
    _source_excludes: "titlesuggest, metadata_author,authorsuggest",
    index: es_index,
    body: {
      size: 1,
      query: {
        bool: {
          should: [
            {
              match: {
                fulltitle: title,
              },
            },
            {
              match: {
                alsoknownas: title,
              },
            },
          ],
          filter: {
            bool: {
              should: [
                {
                  nested: {
                    path: "authors",
                    query: {
                      bool: {
                        must: [
                          {
                            match: {
                              "authors.group.raw": name,
                            },
                          },
                        ],
                      },
                    },
                  },
                },
                {
                  nested: {
                    path: "authors.authors",
                    query: {
                      bool: {
                        must: [
                          {
                            match: {
                              "authors.authors.name.raw": name,
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      },
    },
  });
};

// middleware to use for all requests
router.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  // do logging
  // debug("user-agent: " + req.headers['user-agent']);
  next(); // make sure we go to the next routes and don't stop here
});

/**
    Return game with :gameid
*/
router.get("/games/:gameid", function (req, res, next) {
  debug("==> /games/:gameid");
  debug(
    req.params.gameid + " ==> length=" + req.params.gameid.length + ", integer=" + Number.isInteger(parseInt(req.params.gameid))
  );

  if (Number.isInteger(parseInt(req.params.gameid)) && req.params.gameid.length < 8) {
    var id = ("0000000" + req.params.gameid).slice(-7);
    getGameById(id, req.query.mode).then(
      function (result) {
        res.send(tools.renderLinks(result));
      },
      function (reason) {
        debug("FAILED: getGameById, ", reason);
        res.status(404).end();
      }
    );
  } else {
    res.status(400).end();
  }
});

/**
    Returns a list of random games
*/
router.get("/games/random/:total", function (req, res, next) {
  debug("==> /games/random/:total");

  getRandomX(req.params.total, req.query.mode).then(function (result) {
    res.header("X-Total-Count", result.hits.total);
    res.send(result);
  });
});

/**
    Returns a list of random games with VideoLinks
*/
router.get("/games/randomwithvideos/:total", function (req, res, next) {
  debug("==> /games/randomwithvideos/:total");

  getRandomXwithVideos(req.params.total, req.query.mode).then(function (result) {
    res.header("X-Total-Count", result.hits.total);
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
router.get("/publishers/:name/games", function (req, res, next) {
  debug("==> /publishers/:name/games");

  getGamesByPublisher(req.params.name, req.query.size, req.query.offset, req.query.sort, req.query.mode).then(function (result) {
    res.header("X-Total-Count", result.hits.total);
    res.send(result);
  });
});

/**
    Return game with :title published by :name
*/
router.get("/publishers/:name/games/:title", function (req, res, next) {
  debug("==> /publishers/:name/games/:title");

  getGameByPublisherAndName(req.params.name, req.params.title, req.query.mode).then(function (result) {
    if (result.hits.hits.length === 0) {
      res.status(404).end();
    } else {
      res.send(tools.renderLinks(result.hits.hits[0]));
    }
  });
});

router.get("/authors/:name/games", function (req, res, next) {
  debug("==> /authors/:name/games");

  getGamesByAuthor(req.params.name, req.query.size, req.query.offset, req.query.sort, req.query.mode).then(function (result) {
    res.header("X-Total-Count", result.hits.total);
    res.send(result);
  });
});

router.get("/authors/:name/games/:title", function (req, res, next) {
  debug("==> /authors/:name/games:title");

  getGamesByAuthorAndTitle(req.params.name, req.params.title, req.query.mode).then(function (result) {
    if (result.hits.hits.length === 0) {
      res.status(404).end();
    } else {
      res.send(tools.renderLinks(result.hits.hits[0]));
    }
  });
});

module.exports = router;
