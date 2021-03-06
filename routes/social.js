"use strict";

var config = require("../config.json")[process.env.NODE_ENV || "development"];
var express = require("express");
var router = express.Router();

var elasticsearch = require("elasticsearch");
var debug = require("debug")("zxinfo-services:social");

var elasticClient = new elasticsearch.Client({
  host: config.es_host,
  apiVersion: config.es_apiVersion,
  log: config.es_log,
});

var es_index = config.zxinfo_index;

var media_url = "https://zxinfo.dk/media";
var books_url = "https://archive.zx-spectrum.org.uk/WoS";
var hw_url = "https://archive.zx-spectrum.org.uk";

var getGameById = function (gameid) {
  debug("getGameById()");
  return elasticClient.get({
    index: es_index,
    type: es_index,
    id: gameid,
  });
};

function loadscreen(source) {
  // iterate all additionals to find loading screen, if any
  var loadscreen = null;
  if (source.type == "Compilation") {
    loadscreen = "/images/compilation.png";
  } else if (typeof source.screens != "undefined") {
    var idx = 0;
    var screen = null;
    for (; loadscreen == null && idx < source.screens.length; idx++) {
      if ("Loading screen" == source.screens[idx].type && "Picture" == source.screens[idx].format) {
        loadscreen = source.screens[idx].url;
      }
    }
  }

  if (loadscreen == null) {
    loadscreen = media_url + "/images/empty.png";
  } else if (source.contenttype == "BOOK") {
    loadscreen = books_url + loadscreen;
  } else if (source.contenttype == "HARDWARE") {
    loadscreen = hw_url + loadscreen;
  } else {
    loadscreen = media_url + loadscreen;
  }

  return loadscreen;
}

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
router.get("/details/:gameid", function (req, res, next) {
  getGameById(req.params.gameid).then(function (result) {
    var og_url = "https://zxinfo.dk/details/" + req.params.gameid; // req.protocol + '://' + req.get('host') + req.originalUrl; // points to this endpoint
    var og_title = result._source.fulltitle;
    var og_image = loadscreen(result._source);
    og_image = `https://zxinfo.dk/social/m?url=${og_image}`;
    var og_image_type = "image/jpeg";
    if (og_image.endsWith("png")) {
      og_image_type = "image/png";
    } else if (og_image.endsWith("gif")) {
      og_image_type = "image/gif";
    }

    var og_description;
    if (result._source.machinetype === null) {
      og_description =
        result._source.type + " - " + result._source.releases[0].publisher + "(" + result._source.yearofrelease + ")";
    } else {
      og_description =
        result._source.machinetype +
        ", " +
        result._source.type +
        " - " +
        result._source.releases[0].publisher +
        "(" +
        result._source.yearofrelease +
        ")";
    }
    res.render("social", {
      title: "ZXInfo - The open source ZXDB frontend",
      og_url: og_url,
      og_title: og_title,
      og_image: og_image,
      og_image_type: og_image_type,
      og_description: og_description,
    });
  });
});

const Jimp = require("jimp");

async function convert(req) {
  const image = await Jimp.read(req.query.url);

  image.contain(256, 256, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE);
  return image.getBufferAsync(Jimp.AUTO);
}

router.get("/m", async (req, res) => {
  // TODO: handle correct content-type
  res.set("Content-Type", "image/jpeg");
  const buffer = await convert(req);
  res.status(200).send(new Buffer(buffer));
});

/*
	CATCH ALL
*/
router.get("/*", function (req, res, next) {
  var og_url = "https://zxinfo.dk";
  var og_title = "ZXInfo - The open source ZXDB frontend";
  var og_image = "";
  var og_description =
    "Provides a fantastic desktop and mobile friendly interface to search and browse the ZXDB catalogue for almost all Spectrum software, hardware and books ever released.";
  res.render("social", {
    title: "ZXInfo - The open source ZXDB frontend",
    og_url: og_url,
    og_title: og_title,
    og_image: og_image,
    og_description: og_description,
  });
});

module.exports = router;
