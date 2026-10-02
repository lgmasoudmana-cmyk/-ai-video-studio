import "dotenv/config";
import express from "express";
import multer from "multer";
import RunwayML, { TaskFailedError } from "@runwayml/sdk";
import fs from "node:fs/promises";
import path from "node:path";

const app = express();
const port = process.env.PORT || 3000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

const client = new RunwayML({
  apiKey: process.env.RUNWAYML_API_SECRET
});

app.use(express.json({ limit: "2mb" }));

const INDEX_HTML = `
<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">

<title>AI Video Studio</title>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #0b0f14;
  color: white;
}

.container {
  width: min(900px, 94%);
  margin: auto;
  padding: 24px 0 50px;
}

h1 {
  font-size: 32px;
  margin-bottom: 8px;
}

.subtitle {
  color: #9aa4b2;
  margin-bottom: 25px;
}

.card {
  background: #121820;
  border: 1px solid #273241;
  border-radius: 18px;
  padding: 20px;
  margin-bottom: 18px;
}

label {
  display: block;
  margin-bottom: 8px;
  color: #cbd5e1;
}

textarea,
select,
input {
  width: 100%;
  background: #0b1016;
  color: white;
  border: 1px solid #344153;
  border-radius: 12px;
  padding: 14px;
  font-size: 16px;
  margin-bottom: 16px;
}

textarea {
  min-height: 150px;
  resize: vertical;
}

button {
  width: 100%;
  border: 0;
  border-radius: 14px;
  padding: 16px;
  font-size: 18px;
  font-weight: 700;
  background: #2563eb;
  color: white;
  cursor: pointer;
}

button:disabled {
  opacity: .5;
}

#status {
  margin-top: 16px;
  color: #93c5fd;
  line-height: 1.8;
}

video {
  width: 100%;
  border-radius: 16px;
  margin-top: 18px;
  background: black;
}

.download {
  display: block;
  text-align: center;
  margin-top: 15px;
  padding: 14px;
  border-radius: 12px;
  background: #16a34a;
  color: white;
  text-decoration: none;
  font-weight: bold;
}

.hidden {
  display: none;
}
</style>
</head>

<body>

<div class="container">

  <h1>🎬 AI Video Studio</h1>

  <div class="subtitle">
    ساخت ویدئو با هوش مصنوعی
  </div>

  <div class="card">

    <label>پرامپت ویدئو</label>

    <textarea
      id="prompt"
      placeholder="مثلاً: یک نمای سینمایی از یک خانه لوکس در تهران، حرکت آرام دوربین، نور گرم و طبیعی..."
    ></textarea>

    <label>مدل</label>

    <select id="model">
      <option value="gen4.5">Runway Gen-4.5</option>
      <option value="gen4_turbo">Runway Gen-4 Turbo</option>
    </select>

    <label>مدت ویدئو</label>

    <select id="duration">
      <option value="5">5 ثانیه</option>
      <option value="10">10 ثانیه</option>
    </select>

    <label>نسبت تصویر</label>

    <select id="ratio">
      <option value="1280:720">16:9 افقی</option>
      <option value="720:1280">9:16 عمودی</option>
      <option value="1024:1024">1:1 مربعی</option>
    </select>

    <label>تصویر مرجع — اختیاری</label>

    <input
      id="image"
      type="file"
      accept="image/png,image/jpeg,image/webp"
    />

    <button id="generate">
      🎥 ساخت ویدئو
    </button>

    <div id="status"></div>

    <div id="result" class="hidden">
      <video id="video" controls playsinline></video>

      <a
        id="download"
        class="download"
        target="_blank"
        download
      >
        ⬇️ دریافت ویدئو
      </a>
    </div>

  </div>

</div>

<script>

const button = document.getElementById("generate");
const statusBox = document.getElementById("status");
const result = document.getElementById("result");
const video = document.getElementById("video");
const download = document.getElementById("download");

button.addEventListener("click", async () => {

  const prompt = document.getElementById("prompt").value.trim();
  const model = document.getElementById("model").value;
  const duration = Number(document.getElementById("duration").value);
  const ratio = document.getElementById("ratio").value;
  const image = document.getElementById("image").files[0];

  if (!prompt) {
    alert("لطفاً پرامپت ویدئو را وارد کن.");
    return;
  }

  button.disabled = true;
  result.classList.add("hidden");
  statusBox.textContent = "⏳ در حال ارسال درخواست به Runway...";

  try {

    const form = new FormData();

    form.append("prompt", prompt);
    form.append("model", model);
    form.append("duration", duration);
    form.append("ratio", ratio);

    if (image) {
      form.append("image", image);
    }

    const response = await fetch("/api/generate", {
      method: "POST",
      body: form
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "خطا در ساخت ویدئو");
    }

    statusBox.textContent =
      "🎬 ویدئو ساخته شد. در حال آماده‌سازی فایل...";

    video.src = data.url;
    download.href = data.url;

    result.classList.remove("hidden");

    statusBox.textContent =
      "✅ ویدئو آماده است.";

  } catch (error) {

    console.error(error);

    statusBox.textContent =
      "❌ " + error.message;

  } finally {

    button.disabled = false;

  }

});

</script>

</body>
</html>
`;

app.get("/", (req, res) => {
  res.type("html").send(INDEX_HTML);
});

app.post("/api/generate", upload.single("image"), async (req, res) => {

  try {

    const prompt = req.body.prompt;
    const model = req.body.model || "gen4.5";
    const duration = Number(req.body.duration || 5);
    const ratio = req.body.ratio || "1280:720";

    if (!prompt) {
      return res.status(400).json({
        error: "پرامپت وارد نشده است."
      });
    }

    let promptImage;

    if (req.file) {

      const mime = req.file.mimetype;

      const base64 =
        req.file.buffer.toString("base64");

      promptImage =
        `data:${mime};base64,${base64}`;
    }

    const request = {
      model,
      promptText: prompt,
      ratio,
      duration
    };

    if (promptImage) {
      request.promptImage = promptImage;
    }

    console.log("Starting Runway generation...");

    const task =
      await client.imageToVideo
        .create(request)
        .waitForTaskOutput();

    console.log("Runway task completed.");

    const output =
      task.output?.[0];

    if (!output) {
      throw new Error(
        "Runway ویدئو تولید کرد اما لینک خروجی دریافت نشد."
      );
    }

    res.json({
      success: true,
      url: output
    });

  } catch (error) {

    console.error(error);

    if (error instanceof TaskFailedError) {

      return res.status(500).json({
        error:
          "ساخت ویدئو در Runway ناموفق بود."
      });

    }

    res.status(500).json({
      error:
        error.message || "خطای ناشناخته سرور"
    });

  }

});

app.listen(port, () => {
  console.log(
    `AI Video Studio running on port ${port}`
  );
});
