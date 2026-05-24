import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const PRESETS = {
  screen: "Compression maximale, adaptée à l'affichage écran.",
  ebook: "Bon équilibre pour lecture numérique et partage.",
  printer: "Qualité élevée pour impression standard.",
  prepress: "Qualité très élevée pour prépresse.",
  default: "Réglage Ghostscript par défaut."
};

const STATUS_LABELS = {
  queued: "En attente",
  processing: "Compression en cours",
  done: "PDF prêt",
  failed: "Échec"
};

const EXPERT_GROUPS = [
  {
    title: "PDF",
    fields: [
      ["compatibilityLevel", "Compatibilité PDF"],
      ["autoRotatePages", "Rotation automatique"],
      ["compressPages", "Compresser les flux de page"],
      ["detectDuplicateImages", "Détecter les images dupliquées"]
    ]
  },
  {
    title: "Couleurs",
    fields: [
      ["colorConversionStrategy", "Conversion couleur"],
      ["processColorModel", "Modèle couleur"],
      ["convertCmykImagesToRgb", "Convertir CMYK vers RGB"]
    ]
  },
  {
    title: "Images couleur",
    fields: [
      ["downsampleColorImages", "Réduire les images couleur"],
      ["colorImageResolution", "Résolution couleur"],
      ["colorImageDownsampleType", "Méthode couleur"],
      ["autoFilterColorImages", "Filtre couleur automatique"],
      ["colorImageFilter", "Filtre couleur"]
    ]
  },
  {
    title: "Images grises",
    fields: [
      ["downsampleGrayImages", "Réduire les images grises"],
      ["grayImageResolution", "Résolution grise"],
      ["grayImageDownsampleType", "Méthode grise"],
      ["autoFilterGrayImages", "Filtre gris automatique"],
      ["grayImageFilter", "Filtre gris"]
    ]
  },
  {
    title: "Images monochromes et polices",
    fields: [
      ["downsampleMonoImages", "Réduire les images N/B"],
      ["monoImageResolution", "Résolution N/B"],
      ["monoImageDownsampleType", "Méthode N/B"],
      ["embedAllFonts", "Incorporer les polices"],
      ["subsetFonts", "Sous-ensemble des polices"]
    ]
  }
];

const VALUE_LABELS = {
  true: "Oui",
  false: "Non",
  PageByPage: "Page par page",
  All: "Toutes les pages",
  None: "Aucune",
  LeaveColorUnchanged: "Conserver",
  RGB: "RGB",
  CMYK: "CMYK",
  Gray: "Niveaux de gris",
  UseDeviceIndependentColor: "Couleur indépendante du périphérique",
  DeviceRGB: "DeviceRGB",
  DeviceCMYK: "DeviceCMYK",
  DeviceGray: "DeviceGray",
  Subsample: "Subsample",
  Average: "Average",
  Bicubic: "Bicubic",
  DCTEncode: "JPEG / DCTEncode",
  FlateEncode: "ZIP / FlateEncode"
};

function App() {
  const [file, setFile] = useState(null);
  const [preset, setPreset] = useState("ebook");
  const [expertMode, setExpertMode] = useState(false);
  const [expertDefinitions, setExpertDefinitions] = useState({});
  const [expertOptions, setExpertOptions] = useState({});
  const [job, setJob] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = file && !isSubmitting && (!job || ["done", "failed"].includes(job.status));

  const expiresIn = useMemo(() => {
    if (!job?.expiresAt) {
      return "";
    }
    const seconds = Math.max(0, Math.ceil((job.expiresAt - Date.now()) / 1000));
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return minutes + " min " + rest.toString().padStart(2, "0") + " s";
  }, [job]);

  useEffect(() => {
    async function loadExpertOptions() {
      try {
        const response = await fetch("/api/expert-options");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Impossible de charger les options expert.");
        }
        setExpertDefinitions(data.options);
        setExpertOptions(
          Object.fromEntries(
            Object.entries(data.options).map(([key, definition]) => [key, definition.defaultValue])
          )
        );
      } catch (loadError) {
        setError(loadError.message);
      }
    }

    loadExpertOptions();
  }, []);

  useEffect(() => {
    if (!job || ["done", "failed"].includes(job.status)) {
      return undefined;
    }

    const interval = window.setInterval(async () => {
      try {
        const response = await fetch("/api/jobs/" + job.id);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Impossible de lire le statut.");
        }
        setJob(data);
      } catch (pollError) {
        setError(pollError.message);
      }
    }, 1500);

    return () => window.clearInterval(interval);
  }, [job]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!file) {
      return;
    }

    setError("");
    setIsSubmitting(true);
    setJob(null);

    const formData = new FormData();
    formData.append("pdf", file);
    formData.append("preset", preset);
    formData.append("expertMode", expertMode ? "true" : "false");
    if (expertMode) {
      formData.append("expertOptions", JSON.stringify(expertOptions));
    }

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        body: formData
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Impossible de créer la compression.");
      }
      setJob(data);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateExpertOption(key, value) {
    setExpertOptions((current) => ({ ...current, [key]: value }));
  }

  return (
    <main className="page-shell">
      <section className="tool-panel" aria-labelledby="page-title">
        <div className="heading">
          <p className="eyebrow">Compression PDF</p>
          <h1 id="page-title">Compresser un PDF</h1>
          <p>
            Déposez un fichier PDF, choisissez un niveau Ghostscript, puis récupérez le résultat
            compressé.
          </p>
        </div>

        <form className="compress-form" onSubmit={handleSubmit}>
          <label className="file-drop">
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                setError("");
              }}
            />
            <span>{file ? file.name : "Choisir un PDF"}</span>
            <small>Limite: 50 MB</small>
          </label>

          <fieldset className="preset-grid">
            <legend>Niveau de compression</legend>
            {Object.entries(PRESETS).map(([key, description]) => (
              <label className="preset-option" key={key}>
                <input
                  type="radio"
                  name="preset"
                  value={key}
                  checked={preset === key}
                  onChange={() => setPreset(key)}
                />
                <span>
                  <strong>{key}</strong>
                  <small>{description}</small>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="mode-row">
            <div>
              <strong>Mode expert</strong>
              <small>Options Ghostscript avancées, désactivées par défaut.</small>
            </div>
            <label className="switch-control">
              <input
                type="checkbox"
                checked={expertMode}
                onChange={(event) => setExpertMode(event.target.checked)}
              />
              <span>{expertMode ? "Activé" : "Désactivé"}</span>
            </label>
          </div>

          {expertMode && (
            <section className="expert-panel" aria-label="Options expert Ghostscript">
              {EXPERT_GROUPS.map((group) => (
                <fieldset className="expert-group" key={group.title}>
                  <legend>{group.title}</legend>
                  <div className="expert-grid">
                    {group.fields.map(([key, label]) => {
                      const definition = expertDefinitions[key];
                      return (
                        <label className="select-field" key={key}>
                          <span>{label}</span>
                          <select
                            value={expertOptions[key] || definition?.defaultValue || ""}
                            onChange={(event) => updateExpertOption(key, event.target.value)}
                            disabled={!definition}
                          >
                            {(definition?.values || []).map((value) => (
                              <option value={value} key={value}>
                                {VALUE_LABELS[value] || value}
                              </option>
                            ))}
                          </select>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </section>
          )}

          <button className="primary-button" disabled={!canSubmit} type="submit">
            {isSubmitting ? "Envoi en cours" : "Compresser"}
          </button>
        </form>

        {error && <p className="message error">{error}</p>}

        {job && (
          <section className="status-panel" aria-live="polite">
            <div>
              <span className={"status-dot " + job.status} />
              <strong>{STATUS_LABELS[job.status]}</strong>
            </div>
            {job.status === "queued" && (
              <p>Position dans la file: {job.position || "en attente de confirmation"}</p>
            )}
            {job.status === "processing" && (
              <p>Ghostscript traite le PDF. La page se met à jour automatiquement.</p>
            )}
            {job.status === "failed" && <p>{job.error || "La compression a échoué."}</p>}
            {job.status === "done" && (
              <div className="download-row">
                <p>Le fichier expire dans {expiresIn || "moins d'une minute"}.</p>
                <a className="download-button" href={job.downloadUrl}>
                  Télécharger le PDF
                </a>
              </div>
            )}
          </section>
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
