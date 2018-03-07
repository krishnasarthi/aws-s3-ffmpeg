"use strict";

log("Loading function");

const fs = require("fs");
const ffmpegBinary = require("ffmpeg-static");
const path = require("path");
const aws = require("aws-sdk");

let spawn = require("child_process").spawn;

aws.config.loadFromPath("./config.json");
const s3 = new aws.S3({ apiVersion: "2006-03-01" });

const SOURCE_BUCKET = "mm4-recorded-videos";
const DESTINATION_BUCKET = "mm4-recorded-videos";
const mimeType = "video/mp4";
const SOURCE_EXTENSION = "flv";
const DESTINATION_EXTENSION = "mp4";

log(ffmpegBinary.path);

const key = "room-1/6706160380819268-1520057614.flv";

const params = {
  Bucket: SOURCE_BUCKET,
  Key: key
};


const parsedKey = parseKey(key);
const keyPrefix = parsedKey.prefix;
const filename = parsedKey.filename;

const download = path.join(__dirname, `${filename}.${SOURCE_EXTENSION}`);
const outputDir = path.join(__dirname, `${filename}.${DESTINATION_EXTENSION}`);

main();

//readS3(params);

function downLoadFile(params) {
  return new Promise((resolve, reject) => {
    log(`Starting download: ${params.Bucket}/${params.Key}`);
    getDownloadStream(params)
      .on("end", () => {
        log("Download finished");
        resolve();
      })
      .on("error", err => {
        reject(err);
      })
      .pipe(fs.createWriteStream(download));
  });
}

function getDownloadStream(params) {
  return s3
    .getObject(params)
    .on("error", error => Promise.reject(`S3 Download Error: ${error}`))
    .createReadStream();
}

function parseKey(key) {
  if (!key) return;

  let keyArray = key.split("/");

  let arrayLength = keyArray.length;
  log(keyArray);

  if (keyArray && arrayLength === 1) {
    return {
      prefix: "",
      filename: path.parse(keyArray[0]).name
    };
  }

  let prefixArray = keyArray;

  return {
    prefix: keyArray.slice(0, arrayLength - 1).join('\\'),
    filename: path.parse(keyArray[arrayLength - 1]).name
  };
}

function ffmpeg(filename) {
  log("Starting FFmpeg");
  return new Promise((resolve, reject) => {
    filename = path.parse(filename).name;

    var ops = ["-i", `./${filename}.flv`, "-c", "copy", `${filename}.mp4`];
    spawn(ffmpegBinary.path, ops)
      .on("message", msg => log(msg))
      .on("error", err => reject(err))
      .on("exit", e => {
        log("Ffmpeg operation completed");
        resolve(e);
      });
  });
}

function uploadToBucket(Bucket, Key, Body, contentEncoding, ContentType) {
  const config = {
    Bucket,
    Key,
    Body,
    ContentType,
    ContentEncoding: contentEncoding || undefined,
    CacheControl: "max-age=31536000"
  };

  return s3
    .putObject(config)
    .on("httpUploadProgress", ({ loaded, total }) => {
      log(
        ContentType,
        "Progress:",
        loaded,
        "/",
        total,
        `${Math.round(100 * loaded / total)}%`
      );
    })
    .promise();
}

async function main() {
  await downLoadFile(params);
  await ffmpeg(filename);
}

function log(message) {
  console.log(message);
}

// exports.handler = (event, context, callback) => {
//   //console.log('Received event:', JSON.stringify(event, null, 2));

//   // Get the object from the event and show its content type
//   const bucket = event.Records[0].s3.bucket.name;
//   const key = decodeURIComponent(
//     event.Records[0].s3.object.key.replace(/\+/g, " ")
//   );
//   const params = {
//     Bucket: bucket,
//     Key: key
//   };
//   s3.getObject(params, (err, data) => {
//     if (err) {
//       console.log(err);
//       const message = `Error getting object ${key} from bucket ${bucket}. Make sure they exist and your bucket is in the same region as this function.`;
//       console.log(message);
//       callback(message);
//     } else {
//       console.log("CONTENT TYPE:", data);
//       callback(null, data);
//     }
//   });
// };
