import express from "express";
import multer from "multer";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const app = express();
const isProduction = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT || (isProduction ? 3351 : 3350));
const runtimeDir = process.env.RUNTIME_DIR || path.join(projectRoot, "runtime");
const uploadDir = path.join(runtimeDir, "uploads");
const outputDir = path.join(runtimeDir, "outputs");
const maxUploadMb = Number(process.env.MAX_UPLOAD_MB || 50);
const ttlMs = Number(process.env.FILE_TTL_MINUTES || 10) * 60 * 1000;

const presets = {
  screen: "Compression maximale, qualité adaptée à l'affichage écran.",
  ebook: "Bon équilibre pour lecture numérique et partage.",
  printer: "Qualité élevée pour impression standard.",
  prepress: "Qualité très élevée pour prépresse, fichiers plus lourds.",
  default: "Réglage Ghostscript par défaut."
};

const expertOptionDefinitions = {
  compatibilityLevel: {
    flag: "-dCompatibilityLevel",
    values: ["1.4", "1.5", "1.6", "1.7"],
    defaultValue: "1.4"
  },
  autoRotatePages: {
    flag: "-dAutoRotatePages",
    values: ["PageByPage", "All", "None"],
    defaultValue: "PageByPage",
    nameValue: true
  },
  colorConversionStrategy: {
    flag: "-sColorConversionStrategy",
    values: ["LeaveColorUnchanged", "RGB", "CMYK", "Gray", "UseDeviceIndependentColor"],
    defaultValue: "LeaveColorUnchanged"
  },
  convertCmykImagesToRgb: {
    flag: "-dConvertCMYKImagesToRGB",
    values: ["false", "true"],
    defaultValue: "false"
  },
  processColorModel: {
    flag: "-sProcessColorModel",
    values: ["DeviceRGB", "DeviceCMYK", "DeviceGray"],
    defaultValue: "DeviceRGB"
  },
  downsampleColorImages: {
    flag: "-dDownsampleColorImages",
    values: ["true", "false"],
    defaultValue: "true"
  },
  colorImageResolution: {
    flag: "-dColorImageResolution",
    values: ["72", "96", "150", "200", "300", "600"],
    defaultValue: "150"
  },
  colorImageDownsampleType: {
    flag: "-dColorImageDownsampleType",
    values: ["Subsample", "Average", "Bicubic"],
    defaultValue: "Average",
    nameValue: true
  },
  autoFilterColorImages: {
    flag: "-dAutoFilterColorImages",
    values: ["true", "false"],
    defaultValue: "true"
  },
  colorImageFilter: {
    flag: "-dColorImageFilter",
    values: ["DCTEncode", "FlateEncode"],
    defaultValue: "DCTEncode",
    nameValue: true
  },
  downsampleGrayImages: {
    flag: "-dDownsampleGrayImages",
    values: ["true", "false"],
    defaultValue: "true"
  },
  grayImageResolution: {
    flag: "-dGrayImageResolution",
    values: ["72", "96", "150", "200", "300", "600"],
    defaultValue: "150"
  },
  grayImageDownsampleType: {
    flag: "-dGrayImageDownsampleType",
    values: ["Subsample", "Average", "Bicubic"],
    defaultValue: "Average",
    nameValue: true
  },
  autoFilterGrayImages: {
    flag: "-dAutoFilterGrayImages",
    values: ["true", "false"],
    defaultValue: "true"
  },
  grayImageFilter: {
    flag: "-dGrayImageFilter",
    values: ["DCTEncode", "FlateEncode"],
    defaultValue: "DCTEncode",
    nameValue: true
  },
  downsampleMonoImages: {
    flag: "-dDownsampleMonoImages",
    values: ["true", "false"],
    defaultValue: "true"
  },
  monoImageResolution: {
    flag: "-dMonoImageResolution",
    values: ["150", "200", "300", "600", "1200"],
    defaultValue: "300"
  },
  monoImageDownsampleType: {
    flag: "-dMonoImageDownsampleType",
    values: ["Subsample", "Average", "Bicubic"],
    defaultValue: "Subsample",
    nameValue: true
  },
  detectDuplicateImages: {
    flag: "-dDetectDuplicateImages",
    values: ["true", "false"],
    defaultValue: "true"
  },
  compressPages: {
    flag: "-dCompressPages",
    values: ["true", "false"],
    defaultValue: "true"
  },
  embedAllFonts: {
    flag: "-dEmbedAllFonts",
    values: ["true", "false"],
    defaultValue: "true"
  },
  subsetFonts: {
    flag: "-dSubsetFonts",
    values: ["true", "false"],
    defaultValue: "true"
  }
};

for (const dir of [runtimeDir, uploadDir, outputDir]) {
  mkdirSync(dir, { recursive: true });
}

cleanupRuntimeOnStart();

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, callback) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      callback(null, Date.now() + "-" + randomUUID() + "-" + safeName);
    }
  }),
  limits: {
    fileSize: maxUploadMb * 1024 * 1024,
    files: 1
  },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype !== "application/pdf" && !file.originalname.toLowerCase().endsWith(".pdf")) {
      callback(new Error("Seuls les fichiers PDF sont acceptés."));
      return;
    }
    callback(null, true);
  }
});

const jobs = new Map();
const queue = [];
let activeJobId = null;

app.use(express.json());

app.get("/api/presets", (_req, res) => {
  res.json({ presets });
});

app.get("/api/expert-options", (_req, res) => {
  res.json({ options: publicExpertOptions() });
});

app.post("/api/jobs", upload.single("pdf"), (req, res) => {
  const preset = req.body.preset;
  if (!Object.hasOwn(presets, preset)) {
    removeFile(req.file?.path);
    res.status(400).json({ error: "Niveau de compression invalide." });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: "Aucun PDF reçu." });
    return;
  }

  const expertMode = req.body.expertMode === "true";
  const expertOptions = parseExpertOptions(req.body.expertOptions, expertMode);
  if (expertOptions.error) {
    removeFile(req.file?.path);
    res.status(400).json({ error: expertOptions.error });
    return;
  }

  const id = randomUUID();
  const outputPath = path.join(outputDir, id + ".pdf");
  const job = {
    id,
    preset,
    expertMode,
    expertOptions: expertOptions.values,
    status: "queued",
    originalName: req.file.originalname,
    inputPath: req.file.path,
    outputPath,
    createdAt: Date.now(),
    startedAt: null,
    finishedAt: null,
    expiresAt: null,
    error: null
  };

  jobs.set(id, job);
  queue.push(id);
  processQueue();

  res.status(202).json(publicJob(job));
});

app.get("/api/jobs/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    res.status(404).json({ error: "Job introuvable ou expiré." });
    return;
  }
  res.json(publicJob(job));
});

app.get("/api/jobs/:id/download", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || job.status !== "done" || !job.expiresAt || Date.now() > job.expiresAt) {
    res.status(404).json({ error: "PDF expiré ou indisponible." });
    return;
  }

  const downloadName = compressedFilename(job.originalName);
  res.download(job.outputPath, downloadName);
});

if (isProduction) {
  app.use(express.static(path.join(projectRoot, "dist")));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(projectRoot, "dist", "index.html"));
  });
} else {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa"
  });
  app.use(vite.middlewares);
}

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    res.status(413).json({ error: "Le PDF dépasse la limite de " + maxUploadMb + " MB." });
    return;
  }
  res.status(400).json({ error: error.message || "Requête invalide." });
});

app.listen(port, "0.0.0.0", () => {
  console.log("PDF Compressor listening on " + port);
});

function processQueue() {
  if (activeJobId || queue.length === 0) {
    return;
  }

  const id = queue.shift();
  const job = jobs.get(id);
  if (!job) {
    processQueue();
    return;
  }

  activeJobId = id;
  job.status = "processing";
  job.startedAt = Date.now();

  const args = [
    "-sDEVICE=pdfwrite",
    "-dCompatibilityLevel=" + (job.expertMode ? job.expertOptions.compatibilityLevel : "1.4"),
    "-dPDFSETTINGS=/" + job.preset,
    ...(job.expertMode ? buildExpertArgs(job.expertOptions) : []),
    "-dNOPAUSE",
    "-dQUIET",
    "-dBATCH",
    "-sOutputFile=" + job.outputPath,
    job.inputPath
  ];

  const gs = spawn("gs", args, { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";

  gs.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  gs.on("error", (error) => {
    finishJob(job, false, error.message);
  });

  gs.on("close", (code) => {
    if (job.status !== "processing") {
      return;
    }
    if (code === 0 && existsSync(job.outputPath)) {
      finishJob(job, true);
    } else {
      finishJob(job, false, stderr || "Ghostscript a quitté avec le code " + code + ".");
    }
  });
}

function finishJob(job, succeeded, error = null) {
  activeJobId = null;
  job.finishedAt = Date.now();
  job.expiresAt = job.finishedAt + ttlMs;
  job.status = succeeded ? "done" : "failed";
  job.error = error;

  setTimeout(() => expireJob(job.id), ttlMs);
  processQueue();
}

async function expireJob(id) {
  const job = jobs.get(id);
  if (!job) {
    return;
  }

  await Promise.allSettled([rm(job.inputPath, { force: true }), rm(job.outputPath, { force: true })]);
  jobs.delete(id);
}

function publicJob(job) {
  const position = job.status === "queued" ? queue.indexOf(job.id) + 1 : 0;
  return {
    id: job.id,
    preset: job.preset,
    expertMode: job.expertMode,
    expertOptions: job.expertOptions,
    status: job.status,
    position,
    originalName: job.originalName,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    expiresAt: job.expiresAt,
    error: job.error,
    downloadUrl: job.status === "done" ? "/api/jobs/" + job.id + "/download" : null
  };
}

function parseExpertOptions(rawOptions, expertMode) {
  if (!expertMode) {
    return { values: defaultExpertOptions() };
  }

  let parsed = {};
  if (rawOptions) {
    try {
      parsed = JSON.parse(rawOptions);
    } catch {
      return { error: "Options expert invalides." };
    }
  }

  const values = defaultExpertOptions();
  for (const [key, value] of Object.entries(parsed)) {
    const definition = expertOptionDefinitions[key];
    if (!definition) {
      return { error: "Option Ghostscript non autorisée: " + key + "." };
    }
    const normalizedValue = String(value);
    if (!definition.values.includes(normalizedValue)) {
      return { error: "Valeur invalide pour " + key + "." };
    }
    values[key] = normalizedValue;
  }

  return { values };
}

function defaultExpertOptions() {
  return Object.fromEntries(
    Object.entries(expertOptionDefinitions).map(([key, definition]) => [key, definition.defaultValue])
  );
}

function buildExpertArgs(options) {
  return Object.entries(expertOptionDefinitions)
    .filter(([key]) => key !== "compatibilityLevel")
    .map(([key, definition]) => {
      const value = options[key] || definition.defaultValue;
      const formattedValue = definition.nameValue ? "/" + value : value;
      return definition.flag + "=" + formattedValue;
    });
}

function publicExpertOptions() {
  return Object.fromEntries(
    Object.entries(expertOptionDefinitions).map(([key, definition]) => [
      key,
      {
        values: definition.values,
        defaultValue: definition.defaultValue
      }
    ])
  );
}

function compressedFilename(originalName) {
  const parsed = path.parse(originalName);
  return (parsed.name || "document") + "-compresse.pdf";
}

function removeFile(filePath) {
  if (!filePath) {
    return;
  }
  rm(filePath, { force: true }).catch(() => {});
}

function cleanupRuntimeOnStart() {
  for (const dir of [uploadDir, outputDir]) {
    if (!existsSync(dir)) {
      continue;
    }
    for (const name of readdirSync(dir)) {
      const filePath = path.join(dir, name);
      try {
        if (statSync(filePath).isFile()) {
          unlinkSync(filePath);
        }
      } catch {
        // Runtime cleanup is best-effort on startup.
      }
    }
  }
}
