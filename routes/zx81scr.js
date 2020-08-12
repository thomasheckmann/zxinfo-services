"use strict";

const zx81 = require("./zx81tables");
const Jimp = require("jimp");
const fs = require("fs");

/**
	y = 0-191

 */
function calculateDisplayFile(y) {
  var line = Math.floor(y / 8);
  var row = y - line * 8;

  var hiByte = line & 0b00011000;
  hiByte = hiByte + row;
  var loByte = (line << 5) & 0b11100000;

  return hiByte * 256 + loByte;
}

/**
 * Converts BMP to SCR, A81, TXT & PNG
 *
 * @param {*} filename
 * @param {*} image
 * @param {*} offsetx
 * @param {*} offsety
 *
 * Returns Base64 of PNG
 */
function scr2txt(filename, image, offsetx, offsety) {
  let cleanimage = new Jimp(320, 240, Jimp.cssColorToHex("#cdcdcd"), (err, image) => {
    if (err) throw err;
  });

  var valid = true; // BMP only contains ZX81 characters...
  var dfile = new Array(6912);

  var output_zx81 = [];
  var textline_utc = "";
  for (var y = 0; y < 24; y++) {
    for (var x = 0; x < 32; x++) {
      var posX = offsetx + x * 8;
      var posY = offsety + y * 8;
      var pattern = "";
      for (var dy = 0; dy < 8; dy++) {
        var scr_byte = 0;
        for (var dx = 0; dx < 8; dx++) {
          var color = Jimp.intToRGBA(image.getPixelColor(posX + dx, posY + dy));
          if (color.r > 127 && color.g > 127 && color.b > 127) {
            // high contrast = white
            scr_byte = (scr_byte << 1) & 254;
          } else {
            scr_byte = (scr_byte << 1) | 1;
            cleanimage.setPixelColor(Jimp.cssColorToHex("#000000"), 32 + x * 8 + dx, 24 + y * 8 + dy);
          }
        }
        var dfile_y = calculateDisplayFile(posY + dy - offsety);
        dfile[dfile_y + x] = scr_byte & 255;

        var binary = scr_byte.toString(2);

        pattern += binary.padStart(8, "0");
      }
      var lookup = zx81.charmap.get(pattern);

      valid &= lookup !== undefined;

      var chr = lookup == undefined ? "?" : lookup.chr;
      var utc = lookup == undefined ? 0x003f : lookup.utc;

      output_zx81.push(chr);

      if (chr < 128) {
        textline_utc += "\x1b[7m" + String.fromCharCode(utc) + "\x1b[0m";
      } else {
        textline_utc += String.fromCharCode(utc);
      }
    }
    textline_utc += "\n";
  }

  const blackwhiteattr = 56;
  for (var i = 0; i < 768; i++) {
    dfile[6144 + i] = blackwhiteattr;
  }

  if (!valid) console.log("################ NOT ZX81 ONLY ###############");
  var name = filename.split(".").slice(0, -1).join(".");
  try {
    fs.writeFileSync("./uploads/" + name + ".a81", new Buffer.from(output_zx81));
    fs.writeFileSync("./uploads/" + name + ".txt", new Buffer.from(textline_utc));
    fs.writeFileSync("./uploads/" + name + ".scr", new Buffer.from(dfile));
    cleanimage.write("./uploads/" + name + ".png");
  } catch (e) {
    console.error(e);
  }

  return cleanimage;
}

module.exports = {
  scr2txt: scr2txt,
};
