/**
NODE_ENV=development PORT=8300 DEBUG=zxinfo-services:scr.* nodemon --ignore public/javascripts/config.js

https://blog.bitsrc.io/uploading-files-and-images-with-vue-and-express-2018ca0eecd0
https://bezkoder.com/vue-axios-file-upload/

*/

"use strict";

var config = require("../config.json")[process.env.NODE_ENV || "development"];
var express = require("express");
const multer = require("multer");
var router = express.Router();

var debug = require("debug")("zxinfo-services:scr");

const Jimp = require("jimp");
const zx81 = require("./zx81scr");

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["bmp", "png", "s81", "scr"];
  var extension = file.originalname.substring(file.originalname.lastIndexOf(".") + 1).toLowerCase();

  if (!allowedTypes.includes(extension)) {
    const error = new Error("Incorrect file");
    error.code = "INCORRECT_FILETYPE";
    return cb(error, false);
  }
  cb(null, true);
};

const upload = multer({ dest: "./uploads", fileFilter, limits: { fileSize: 1000000 } });

// middleware to use for all requests
router.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  // do logging
  // debug("user-agent: " + req.headers['user-agent']);
  next(); // make sure we go to the next routes and don't stop here
});

router.post("/upload", upload.single("file"), (req, res) => {
  debug("==> /upload - " + JSON.stringify(req.file));

  const offsetx = parseInt(req.query.ox);
  const offsety = parseInt(req.query.oy);

  debug(`[upload] - offsetx = ${offsetx}, offsety = ${offsety}`);

  var name = req.file.originalname.split(".").slice(0, -1).join(".");
  if (req.file.originalname.toLowerCase().endsWith(".bmp") || req.file.originalname.toLowerCase().endsWith(".png")) {
    // load BMP
    Jimp.read(req.file.path, (err, image) => {
      if (err) throw err;

      debug(`[BMP] - size WxH: ${image.bitmap.width}x${image.bitmap.height}`);

      // largest known
      if (image.bitmap.width > 413) {
        image.resize(320, 240);
      }

      var r = zx81.convertBMP(req.file.originalname, image, offsetx, offsety);
      var imagePNG = r.png;
      imagePNG.getBase64(Jimp.MIME_PNG, (error, img) => {
        if (error) throw error;
        else {
          res.json({
            output: {
              png: {
                base64: img,
                height: image.bitmap.height,
                width: image.bitmap.width,
                filename: name + ".png",
              },
              ovr: { filename: name + "_ovr.png" },
              s81: { filename: name + ".s81" },
              scr: { filename: name + ".scr" },
              txt: { filename: name + ".txt", data: r.txt },
              used_offsetx: r.used_offsetx,
              used_offsety: r.used_offsety,
            },
            file: req.file,
          });
        }
      });
    });
  } else if (req.file.originalname.toLowerCase().endsWith(".s81")) {
    var r = zx81.convertS81(req.file, offsetx, offsety);
    var imagePNG = r.png;
    imagePNG.getBase64(Jimp.MIME_PNG, (error, img) => {
      if (error) throw error;
      else {
        res.json({
          output: {
            png: {
              base64: img,
              height: imagePNG.bitmap.height,
              width: imagePNG.bitmap.width,
              filename: name + ".png",
            },
            ovr: { filename: name + "_ovr.png" },
            s81: { filename: name + ".s81" },
            scr: { filename: name + ".scr" },
            txt: { filename: name + ".txt", data: r.txt },
            used_offsetx: r.used_offsetx,
            used_offsety: r.used_offsety,
          },
          file: req.file,
        });
      }
    });
  } else if (req.file.originalname.toLowerCase().endsWith(".scr")) {
    var r = zx81.convertSCR(req.file, offsetx, offsety);
    var imagePNG = r.png;
    imagePNG.getBase64(Jimp.MIME_PNG, (error, img) => {
      if (error) throw error;
      else {
        res.json({
          output: {
            png: {
              base64: img,
              height: imagePNG.bitmap.height,
              width: imagePNG.bitmap.width,
              filename: name + ".png",
            },
            ovr: { filename: name + "_ovr.png" },
            s81: { filename: name + ".s81" },
            scr: { filename: name + ".scr" },
            txt: { filename: name + ".txt", data: r.txt },
            used_offsetx: r.used_offsetx,
            used_offsety: r.used_offsety,
          },
          file: req.file,
        });
      }
    });
  }
});

router.get("/files/:name", function (req, res, next) {
  debug("==> /files - " + req.params.name);
  const file = `./uploads/${req.params.name}`;
  res.download(file); // Set disposition and send it.
});

router.use(function (err, req, res, next) {
  if (err.code === "INCORRECT_FILETYPE") {
    res.status(422).json({ error: "Wrong filetype" });
    return;
  }
  if (err.code === "LIMIT_FILE_SIZE") {
    res.status(422).json({ error: "Allowed file size is 1000KB" });
    return;
  }
});

module.exports = router;
