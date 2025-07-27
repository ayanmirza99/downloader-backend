// server.js
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { exec } = require("child_process");
const fs = require("fs");

const app = express();
app.use(
  cors({
    origin: "https://downloader-frontend.vercel.app/",
    exposedHeaders: [
      "x-video-title",
      "x-video-uploader",
      "x-video-thumbnail",
      "x-video-duration",
    ],
  })
);

app.use(bodyParser.json());
const ytDlpPath = `yt-dlp`;

app.post("/api/download", (req, res) => {
  const videoUrl = req.body.url;
  const outputFile = `video_${Date.now()}.mp4`;

  // First get metadata
  exec(`${ytDlpPath} --dump-json ${videoUrl}`, (infoErr, stdout) => {
    if (infoErr) {
      console.error("Metadata error:", infoErr);
      return res.status(500).send("Failed to fetch video info");
    }

    let videoInfo;
    try {
      videoInfo = JSON.parse(stdout);
    } catch (parseErr) {
      console.error("Failed to parse yt-dlp JSON:", parseErr);
      return res.status(500).send("Error parsing video info");
    }

    // Clean values before setting
    const safeTitle = videoInfo.title
      ? videoInfo.title.replace(/"/g, "'")
      : "video";
    const uploader = videoInfo.uploader || "unknown";
    const thumbnail = videoInfo.thumbnail || "";
    const duration = videoInfo.duration || 0;

    // Now start download
    exec(`${ytDlpPath} -o ${outputFile} ${videoUrl}`, (downloadErr) => {
      if (downloadErr) {
        console.error("Download error:", downloadErr);
        return res.status(500).send("Download failed");
      }

      // ✅ Set metadata headers BEFORE streaming the file
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeTitle}.mp4"`
      );

      // Custom headers
      res.setHeader("x-video-title", encodeURIComponent(safeTitle));
      res.setHeader("x-video-uploader", encodeURIComponent(uploader));
      res.setHeader("x-video-thumbnail", encodeURIComponent(thumbnail));
      res.setHeader("x-video-duration", duration.toString());

      const fileStream = fs.createReadStream(outputFile);
      fileStream.pipe(res);
      fileStream.on("close", () => fs.unlinkSync(outputFile));
    });
  });
});

app.listen(5000, () => console.log("Server running on port 5000"));
