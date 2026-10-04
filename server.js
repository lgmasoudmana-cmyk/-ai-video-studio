import "dotenv/config";
import express from "express";
import multer from "multer";
import RunwayML, { TaskFailedError } from "@runwayml/sdk";

const app = express();

const PORT = process.env.PORT || 10000;

// -----------------------------
// Middleware
// -----------------------------

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// -----------------------------
// Upload configuration
// -----------------------------

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

// -----------------------------
// Runway client
// -----------------------------

if (!process.env.RUNWAYML_API_SECRET) {
  console.warn(
    "WARNING: RUNWAYML_API_SECRET is not configured."
  );
}

const runway = new RunwayML({
  apiKey: process.env.RUNWAYML_API_SECRET
});

// -----------------------------
// Health check
// -----------------------------

app.get("/", (req, res) => {
  res.json({
    ok: true,
    name: "AI Video Studio",
    status: "running",
    runway: Boolean(process.env.RUNWAYML_API_SECRET)
  });
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    status: "healthy"
  });
});

// -----------------------------
// Generate video
// -----------------------------

app.post(
  "/api/generate-video",
  upload.single("referenceImage"),
  async (req, res) => {
    try {
      const prompt =
        req.body.prompt ||
        req.body.promptText ||
        "";

      const duration = Number(req.body.duration || 5);

      const ratio =
        req.body.ratio ||
        "1280:720";

      if (!prompt.trim()) {
        return res.status(400).json({
          ok: false,
          error: "Video prompt is required."
        });
      }

      if (!process.env.RUNWAYML_API_SECRET) {
        return res.status(500).json({
          ok: false,
          error:
            "RUNWAYML_API_SECRET is missing on the server."
        });
      }

      // Gen-4.5 supported durations should be supplied
      // by the frontend. We keep this simple for now.
      if (![5, 10].includes(duration)) {
        return res.status(400).json({
          ok: false,
          error: "Duration must be 5 or 10 seconds."
        });
      }

      const supportedRatios = [
        "1280:720",
        "1584:672",
        "1104:832",
        "720:1280",
        "832:1104",
        "672:1584",
        "960:960"
      ];

      if (!supportedRatios.includes(ratio)) {
        return res.status(400).json({
          ok: false,
          error: "Unsupported video ratio."
        });
      }

      // ---------------------------------
      // Convert uploaded image to data URI
      // ---------------------------------

      let promptImage = undefined;

      if (req.file) {
        const mimeType =
          req.file.mimetype || "image/png";

        const base64 =
          req.file.buffer.toString("base64");

        promptImage =
          `data:${mimeType};base64,${base64}`;
      }

      console.log("--------------------------------");
      console.log("AI Video Studio");
      console.log("Generating video...");
      console.log("Model: gen4.5");
      console.log("Duration:", duration);
      console.log("Ratio:", ratio);
      console.log(
        "Reference image:",
        Boolean(promptImage)
      );
      console.log("--------------------------------");

      // ---------------------------------
      // Create Runway task
      // ---------------------------------

      const taskRequest = {
        model: "gen4.5",
        promptText: prompt.trim(),
        ratio,
        duration
      };

      if (promptImage) {
        taskRequest.promptImage = promptImage;
      }

      const task =
        await runway.imageToVideo.create(
          taskRequest
        );

      console.log(
        "Runway task created:",
        task.id
      );

      return res.status(202).json({
        ok: true,
        message: "Video generation started.",
        taskId: task.id,
        status: task.status || "PENDING"
      });

    } catch (error) {
      console.error(
        "VIDEO GENERATION ERROR:"
      );

      console.error(error);

      if (error instanceof TaskFailedError) {
        return res.status(500).json({
          ok: false,
          error: "Runway video generation failed.",
          details: error.taskDetails || null
        });
      }

      return res.status(500).json({
        ok: false,
        error:
          error?.message ||
          "Unknown server error."
      });
    }
  }
);

// -----------------------------
// Check video task
// -----------------------------

app.get(
  "/api/video-status/:taskId",
  async (req, res) => {
    try {
      const taskId =
        req.params.taskId;

      if (!taskId) {
        return res.status(400).json({
          ok: false,
          error: "Task ID is required."
        });
      }

      const task =
        await runway.tasks.retrieve(
          taskId
        );

      const response = {
        ok: true,
        taskId: task.id,
        status: task.status
      };

      // When Runway finishes successfully,
      // output[0] contains the generated video URL.
      if (
        task.status === "SUCCEEDED" &&
        task.output
      ) {
        response.videoUrl =
          task.output[0] || null;
      }

      if (task.status === "FAILED") {
        response.error =
          task.failure ||
          task.failureCode ||
          "Runway task failed.";
      }

      return res.json(response);

    } catch (error) {
      console.error(
        "TASK STATUS ERROR:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          error?.message ||
          "Could not retrieve task status."
      });
    }
  }
);

// -----------------------------
// Start server
// -----------------------------

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    "======================================"
  );

  console.log(
    "🎬 AI Video Studio"
  );

  console.log(
    `🚀 Server running on port ${PORT}`
  );

  console.log(
    `🌐 PORT: ${PORT}`
  );

  console.log(
    `🔑 Runway API configured: ${
      Boolean(
        process.env.RUNWAYML_API_SECRET
      )
    }`
  );

  console.log(
    "======================================"
  );
});
