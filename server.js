import "dotenv/config";
import express from "express";
import multer from "multer";
import RunwayML, {
  TaskFailedError,
  APIStatusError,
  toFile
} from "@runwayml/sdk";

const app = express();
const port = process.env.PORT || 3000;

/*
==========================================
UPLOAD CONFIGURATION
==========================================
*/

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {
    const allowed = [
      "image/png",
      "image/jpeg",
      "image/webp"
    ];

    if (!allowed.includes(file.mimetype)) {
      return cb(
        new Error(
          "فرمت تصویر باید PNG، JPG یا WEBP باشد."
        )
      );
    }

    cb(null, true);
  }
});

/*
==========================================
RUNWAY CLIENT
==========================================
*/

if (!process.env.RUNWAYML_API_SECRET) {
  console.warn(
    "⚠️ RUNWAYML_API_SECRET تنظیم نشده است."
  );
}

const client = new RunwayML({
  apiKey: process.env.RUNWAYML_API_SECRET
});

app.use(
  express.json({
    limit: "2mb"
  })
);

/*
==========================================
HTML
==========================================
*/

const INDEX_HTML = `
<!doctype html>

<html lang="fa" dir="rtl">

<head>

<meta charset="utf-8">

<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
>

<title>AI Video Studio</title>

<style>

* {
  box-sizing: border-box;
}

body {
  margin: 0;

  font-family:
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;

  background: #0b0f14;
  color: white;
}

.container {
  width: min(900px, 94%);

  margin: auto;

  padding:
    24px
    0
    60px;
}

h1 {
  font-size: 32px;

  margin:
    0
    0
    8px;
}

.subtitle {
  color: #9aa4b2;

  margin-bottom: 25px;
}

.card {
  background: #121820;

  border:
    1px
    solid
    #273241;

  border-radius: 18px;

  padding: 20px;
}

label {
  display: block;

  margin:
    18px
    0
    8px;

  color: #cbd5e1;

  font-weight: 600;
}

textarea,
select,
input {
  width: 100%;

  background: #0b1016;

  color: white;

  border:
    1px
    solid
    #344153;

  border-radius: 12px;

  padding: 14px;

  font-size: 16px;
}

textarea {
  min-height: 170px;

  resize: vertical;

  line-height: 1.8;
}

input[type="file"] {
  padding: 12px;
}

button {
  width: 100%;

  border: 0;

  border-radius: 14px;

  padding: 17px;

  margin-top: 20px;

  font-size: 18px;

  font-weight: 700;

  background: #2563eb;

  color: white;

  cursor: pointer;
}

button:disabled {
  opacity: .5;

  cursor: not-allowed;
}

#status {
  margin-top: 18px;

  color: #93c5fd;

  line-height: 1.9;

  white-space: pre-wrap;
}

#progress {
  display: none;

  margin-top: 15px;

  height: 7px;

  background: #1e293b;

  border-radius: 99px;

  overflow: hidden;
}

#progressBar {
  width: 0%;

  height: 100%;

  background: #2563eb;

  transition:
    width
    .4s
    ease;
}

video {
  width: 100%;

  border-radius: 16px;

  margin-top: 20px;

  background: black;
}

.download {
  display: block;

  text-align: center;

  margin-top: 15px;

  padding: 15px;

  border-radius: 12px;

  background: #16a34a;

  color: white;

  text-decoration: none;

  font-weight: bold;
}

.info {
  margin-top: 10px;

  color: #94a3b8;

  font-size: 13px;

  line-height: 1.8;
}

.error {
  color: #fca5a5 !important;
}

.success {
  color: #86efac !important;
}

.warning {
  color: #fde68a !important;
}

.hidden {
  display: none;
}

hr {
  border: 0;

  border-top:
    1px
    solid
    #273241;

  margin:
    25px
    0;
}

</style>

</head>

<body>

<div class="container">

<h1>
🎬 AI Video Studio
</h1>

<div class="subtitle">
ساخت ویدئو با هوش مصنوعی
</div>

<div class="card">

<label>
پرامپت ویدئو
</label>

<textarea
  id="prompt"
  placeholder="مثلاً: نمای سینمایی و واقع‌گرایانه از یک خانه لوکس در تهران، نور گرم طبیعی، حرکت آرام دوربین..."
></textarea>

<div class="info">
پرامپت را دقیق و توصیفی بنویس.
</div>


<label>
مدل
</label>

<select id="model">

<option value="gen4.5">
Runway Gen-4.5
</option>

<option value="gen4_turbo">
Runway Gen-4 Turbo
</option>

</select>


<label>
مدت ویدئو
</label>

<select id="duration">

<option value="5">
5 ثانیه
</option>

<option value="10">
10 ثانیه
</option>

</select>


<label>
نسبت تصویر
</label>

<select id="ratio">

<option value="1280:720">
16:9 افقی
</option>

<option value="720:1280">
9:16 عمودی
</option>

<option value="960:960">
1:1 مربعی
</option>

<option value="1104:832">
4:3 افقی
</option>

<option value="832:1104">
3:4 عمودی
</option>

<option value="1584:672">
21:9 سینمایی
</option>

</select>


<label>
تصویر مرجع — اختیاری
</label>

<input
  id="image"
  type="file"
  accept="image/png,image/jpeg,image/webp"
>

<div class="info">
PNG، JPG یا WEBP — حداکثر ۵ مگابایت
</div>


<button id="generate">
🎥 ساخت ویدئو
</button>


<div id="progress">

<div id="progressBar"></div>

</div>


<div id="status"></div>


<div id="result" class="hidden">

<hr>

<video
  id="video"
  controls
  playsinline
></video>

<a
  id="download"
  class="download"
  target="_blank"
  rel="noopener"
  download
>
⬇️ دریافت ویدئو
</a>

</div>

</div>

</div>


<script>

const button =
  document.getElementById("generate");

const statusBox =
  document.getElementById("status");

const result =
  document.getElementById("result");

const video =
  document.getElementById("video");

const download =
  document.getElementById("download");

const progress =
  document.getElementById("progress");

const progressBar =
  document.getElementById("progressBar");

const modelSelect =
  document.getElementById("model");

const ratioSelect =
  document.getElementById("ratio");


function setStatus(
  message,
  type = ""
) {

  statusBox.textContent =
    message;

  statusBox.className =
    type;

}


function setProgress(value) {

  progress.style.display =
    "block";

  progressBar.style.width =
    value + "%";

}


/*
==========================================
MODEL / RATIO UI
==========================================
*/

function updateRatios() {

  const model =
    modelSelect.value;

  const hasImage =
    document
      .getElementById("image")
      .files.length > 0;

  const options =
    Array.from(
      ratioSelect.options
    );

  /*
    Gen-4.5 text-to-video only
    supports 16:9 and 9:16.
  */

  if (
    model === "gen4.5" &&
    !hasImage
  ) {

    options.forEach(
      option => {

        const allowed =
          [
            "1280:720",
            "720:1280"
          ].includes(
            option.value
          );

        option.disabled =
          !allowed;

      }
    );

    ratioSelect.value =
      "1280:720";

  } else {

    /*
      Image-to-video supports
      the additional ratios.
    */

    options.forEach(
      option => {

        option.disabled =
          false;

      }
    );

  }

}


modelSelect.addEventListener(
  "change",
  updateRatios
);


document
  .getElementById("image")
  .addEventListener(
    "change",
    updateRatios
  );


updateRatios();


/*
==========================================
GENERATE
==========================================
*/

button.addEventListener(
  "click",
  async () => {

    const prompt =
      document
        .getElementById("prompt")
        .value
        .trim();

    const model =
      modelSelect.value;

    const duration =
      Number(
        document
          .getElementById("duration")
          .value
      );

    const ratio =
      ratioSelect.value;

    const imageInput =
      document
        .getElementById("image");

    const image =
      imageInput.files[0];


    /*
      Prompt validation
    */

    if (!prompt) {

      setStatus(
        "❌ لطفاً پرامپت ویدئو را وارد کن.",
        "error"
      );

      return;
    }


    if (prompt.length > 1000) {

      setStatus(
        "❌ پرامپت نباید بیشتر از ۱۰۰۰ کاراکتر باشد.",
        "error"
      );

      return;
    }


    /*
      Image validation
    */

    if (
      image &&
      image.size >
      5 * 1024 * 1024
    ) {

      setStatus(
        "❌ حجم تصویر بیشتر از ۵ مگابایت است.",
        "error"
      );

      return;
    }


    /*
      Gen-4 Turbo requires image
    */

    if (
      model === "gen4_turbo" &&
      !image
    ) {

      setStatus(
        "❌ برای Gen-4 Turbo باید تصویر مرجع انتخاب کنی.",
        "error"
      );

      return;
    }


    button.disabled =
      true;

    result.classList.add(
      "hidden"
    );


    setProgress(10);

    setStatus(
      "⏳ در حال ارسال درخواست..."
    );


    try {

      const form =
        new FormData();


      form.append(
        "prompt",
        prompt
      );


      form.append(
        "model",
        model
      );


      form.append(
        "duration",
        String(duration)
      );


      form.append(
        "ratio",
        ratio
      );


      if (image) {

        form.append(
          "image",
          image
        );

      }


      setProgress(20);

      setStatus(
        "📤 در حال ارسال اطلاعات به سرور..."
      );


      const response =
        await fetch(
          "/api/generate",
          {
            method: "POST",
            body: form
          }
        );


      setProgress(85);


      let data;

      try {

        data =
          await response.json();

      } catch {

        throw new Error(
          "پاسخ معتبر از سرور دریافت نشد."
        );

      }


      if (!response.ok) {

        throw new Error(
          data.error ||
          "ساخت ویدئو ناموفق بود."
        );

      }


      if (!data.url) {

        throw new Error(
          "لینک ویدئو از Runway دریافت نشد."
        );

      }


      /*
        Show video
      */

      video.src =
        data.url;

      download.href =
        data.url;


      result.classList.remove(
        "hidden"
      );


      setProgress(100);


      setStatus(
        "✅ ویدئو با موفقیت ساخته شد.",
        "success"
      );


    } catch (error) {

      console.error(
        "Frontend error:",
        error
      );


      setProgress(0);


      setStatus(
        "❌ " +
        (
          error.message ||
          "خطای ناشناخته"
        ),
        "error"
      );


    } finally {

      button.disabled =
        false;

    }

  }
);

</script>

</body>

</html>
`;


/*
==========================================
HOME
==========================================
*/

app.get(
  "/",
  (req, res) => {

    res
      .type("html")
      .send(INDEX_HTML);

  }
);


/*
==========================================
GENERATE VIDEO API
==========================================
*/

app.post(
  "/api/generate",

  upload.single("image"),

  async (req, res) => {

    try {

      /*
      ------------------------------------
      API KEY
      ------------------------------------
      */

      if (
        !process.env.RUNWAYML_API_SECRET
      ) {

        return res.status(500).json({

          error:
            "کلید RUNWAYML_API_SECRET در Environment Variables تنظیم نشده است."

        });

      }


      /*
      ------------------------------------
      READ INPUT
      ------------------------------------
      */

      const prompt =
        String(
          req.body.prompt || ""
        ).trim();

      const model =
        String(
          req.body.model ||
          "gen4.5"
        );

      const duration =
        Number(
          req.body.duration ||
          5
        );

      const ratio =
        String(
          req.body.ratio ||
          "1280:720"
        );


      /*
      ------------------------------------
      PROMPT VALIDATION
      ------------------------------------
      */

      if (!prompt) {

        return res.status(400).json({

          error:
            "پرامپت وارد نشده است."

        });

      }


      if (
        prompt.length > 1000
      ) {

        return res.status(400).json({

          error:
            "پرامپت نباید بیشتر از ۱۰۰۰ کاراکتر باشد."

        });

      }


      /*
      ------------------------------------
      MODEL VALIDATION
      ------------------------------------
      */

      const allowedModels = [
        "gen4.5",
        "gen4_turbo"
      ];


      if (
        !allowedModels.includes(
          model
        )
      ) {

        return res.status(400).json({

          error:
            "مدل انتخاب‌شده معتبر نیست."

        });

      }


      /*
      ------------------------------------
      DURATION
      ------------------------------------
      */

      if (
        !Number.isInteger(
          duration
        ) ||
        duration < 2 ||
        duration > 10
      ) {

        return res.status(400).json({

          error:
            "مدت ویدئو باید بین ۲ تا ۱۰ ثانیه باشد."

        });

      }


      /*
      ------------------------------------
      IMAGE
      ------------------------------------
      */

      const hasImage =
        Boolean(req.file);


      /*
      Gen-4 Turbo requires image
      */

      if (
        model === "gen4_turbo" &&
        !hasImage
      ) {

        return res.status(400).json({

          error:
            "برای Runway Gen-4 Turbo باید تصویر مرجع انتخاب شود."

        });

      }


      /*
      ------------------------------------
      RATIO VALIDATION
      ------------------------------------
      */

      const gen45TextRatios = [
        "1280:720",
        "720:1280"
      ];


      const gen45ImageRatios = [
        "1280:720",
        "720:1280",
        "960:960",
        "1104:832",
        "832:1104",
        "1584:672"
      ];


      const turboRatios = [
        "1280:720",
        "720:1280",
        "960:960",
        "1104:832",
        "832:1104",
        "1584:672"
      ];


      if (
        model === "gen4.5"
      ) {

        if (
          hasImage
        ) {

          if (
            !gen45ImageRatios.includes(
              ratio
            )
          ) {

            return res.status(400).json({

              error:
                "نسبت تصویر برای Gen-4.5 Image-to-Video معتبر نیست."

            });

          }

        } else {

          if (
            !gen45TextRatios.includes(
              ratio
            )
          ) {

            return res.status(400).json({

              error:
                "برای Gen-4.5 بدون تصویر فقط 16:9 یا 9:16 انتخاب کن."

            });

          }

        }

      }


      if (
        model === "gen4_turbo" &&
        !turboRatios.includes(
          ratio
        )
      ) {

        return res.status(400).json({

          error:
            "نسبت تصویر انتخاب‌شده برای Gen-4 Turbo معتبر نیست."

        });

      }


      /*
      ------------------------------------
      CREATE RUNWAY REQUEST
      ------------------------------------
      */

      const request = {

        model,

        promptText:
          prompt,

        ratio,

        duration

      };


      /*
      ------------------------------------
      UPLOAD IMAGE TO RUNWAY
      ------------------------------------
      */

      if (req.file) {

        console.log(
          "Uploading image to Runway..."
        );


        const filename =
          req.file.originalname ||
          "reference-image.png";


        const runwayFile =
          await client.uploads
            .createEphemeral(

              toFile(
                req.file.buffer,
                filename,
                {
                  type:
                    req.file.mimetype
                }
              )

            );


        if (
          !runwayFile ||
          !runwayFile.uri
        ) {

          throw new Error(
            "تصویر به Runway آپلود شد اما URI دریافت نشد."
          );

        }


        console.log(
          "Runway image URI:",
          runwayFile.uri
        );


        request.promptImage =
          runwayFile.uri;

      }


      /*
      ------------------------------------
      LOG
      ------------------------------------
      */

      console.log(
        "================================"
      );

      console.log(
        "STARTING RUNWAY GENERATION"
      );

      console.log(
        "Model:",
        model
      );

      console.log(
        "Duration:",
        duration
      );

      console.log(
        "Ratio:",
        ratio
      );

      console.log(
        "Has image:",
        hasImage
      );

      console.log(
        "================================"
      );


      /*
      ------------------------------------
      CREATE TASK
      ------------------------------------
      */

      const task =
        await client.imageToVideo
          .create(
            request
          )
          .waitForTaskOutput();


      console.log(
        "================================"
      );

      console.log(
        "RUNWAY TASK COMPLETED"
      );

      console.log(
        task
      );

      console.log(
        "================================"
      );


      /*
      ------------------------------------
      GET OUTPUT
      ------------------------------------
      */

      const output =
        task.output?.[0];


      if (!output) {

        console.error(
          "Runway task response:",
          task
        );


        throw new Error(
          "Runway ویدئو را ساخت اما لینک خروجی دریافت نشد."
        );

      }


      /*
      ------------------------------------
      RETURN VIDEO URL
      ------------------------------------
      */

      return res.json({

        success:
          true,

        url:
          output

      });


    } catch (error) {

      console.error(
        "================================"
      );

      console.error(
        "RUNWAY ERROR"
      );

      console.error(
        error
      );

      console.error(
        "================================"
      );


      /*
      ------------------------------------
      TASK FAILED
      ------------------------------------
      */

      if (
        error instanceof TaskFailedError
      ) {

        console.error(
          "Task details:",
          error.taskDetails
        );


        return res.status(500).json({

          error:
            error.taskDetails
              ?.failureReason ||
            error.taskDetails
              ?.failureCode ||
            "ساخت ویدئو در Runway ناموفق بود."

        });

      }


      /*
      ------------------------------------
      API ERROR
      ------------------------------------
      */

      if (
        error instanceof APIStatusError
      ) {

        let details = "";


        try {

          details =
            JSON.stringify(
              error.response?.data ||
              error.response ||
              {}
            );

        } catch {

          details = "";

        }


        return res.status(
          error.status ||
          500
        ).json({

          error:
            "Runway خطا برگرداند." +
            (
              details
                ? "\\n\\n" +
                  details
                : ""
            )

        });

      }


      /*
      ------------------------------------
      MULTER FILE SIZE
      ------------------------------------
      */

      if (
        error?.code ===
        "LIMIT_FILE_SIZE"
      ) {

        return res.status(400).json({

          error:
            "حجم تصویر بیشتر از ۵ مگابایت است."

        });

      }


      /*
      ------------------------------------
      MULTER FILE TYPE
      ------------------------------------
      */

      if (
        error?.message &&
        error.message.includes(
          "فرمت تصویر"
        )
      ) {

        return res.status(400).json({

          error:
            error.message

        });

      }


      /*
      ------------------------------------
      UNKNOWN ERROR
      ------------------------------------
      */

      return res.status(500).json({

        error:
          error?.message ||
          "خطای ناشناخته سرور"

      });

    }

  }
);


/*
  ==========================================
  START SERVER
  ==========================================
*/

app.listen(
  port,
  "0.0.0.0",
  () => {
    console.log(
      "================================"
    );

    console.log(
      "🎬 AI Video Studio"
    );

    console.log(
      "Running on port:",
      port
    );

    console.log(
      "================================"
    );
  }
);
