"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import { fileNameForFormat, formatBytes, processImageFile } from "@/lib/image-tools";

const CROP_OPTIONS = [
  ["original", "Original"],
  ["square", "1:1"],
  ["portrait", "4:5"],
  ["landscape", "16:9"],
];

const FORMAT_OPTIONS = [
  ["webp", "WebP"],
  ["jpeg", "JPEG"],
  ["png", "PNG"],
];

const CROP_ASPECT = {
  original: "auto",
  square: "1 / 1",
  portrait: "4 / 5",
  landscape: "16 / 9",
};

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 6v5h-5M4 18v-5h5M6.2 9a7 7 0 0 1 11.7-2.5L20 11M4 13l2.1 4.5A7 7 0 0 0 18 15" />
    </svg>
  );
}

function safeBaseName(name) {
  return String(name || "media").replace(/\.[^.]+$/, "") || "media";
}

function fileExtension(name) {
  const match = String(name || "").match(/(\.[^.]+)$/);
  return match ? match[1] : "";
}

function xhrUpload(url, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`S3 upload failed (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Upload could not reach S3. The bucket may need a CORS rule for this app."));
    xhr.send(file);
  });
}

export default function Home() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [outputFormat, setOutputFormat] = useState("webp");
  const [cropMode, setCropMode] = useState("original");
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [uploadResult, setUploadResult] = useState(null);
  const [shareFile, setShareFile] = useState(null);
  const [copyLabel, setCopyLabel] = useState("Copy URL");
  const [items, setItems] = useState([]);
  const [libraryState, setLibraryState] = useState("loading");
  const [libraryError, setLibraryError] = useState("");
  const [filter, setFilter] = useState("all");

  const isImage = selectedFile?.type?.startsWith("image/");
  const isVideo = selectedFile?.type?.startsWith("video/");

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl("");
      return undefined;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  useEffect(() => {
    if (!selectedFile) return;
    if (isImage) setFileName(fileNameForFormat(selectedFile.name, outputFormat));
    else setFileName(selectedFile.name);
  }, [selectedFile, outputFormat, isImage]);

  const loadLibrary = useCallback(async () => {
    setLibraryState("loading");
    setLibraryError("");
    try {
      const response = await fetch("/api/media", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load the library.");
      setItems(data.items || []);
      setLibraryState("ready");
    } catch (error) {
      setLibraryError(error.message);
      setLibraryState("error");
    }
  }, []);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  const filteredItems = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((item) => item.type === filter);
  }, [items, filter]);

  function pickFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setUploadError("Choose an image or video file.");
      return;
    }
    setSelectedFile(file);
    setCropMode("original");
    setZoom(1);
    setPanX(0);
    setPanY(0);
    setOutputFormat("webp");
    setUploadResult(null);
    setShareFile(null);
    setUploadError("");
    window.setTimeout(() => document.getElementById("edit-media")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }

  function clearSelection() {
    setSelectedFile(null);
    setUploadResult(null);
    setShareFile(null);
    setUploadError("");
    setUploadProgress(0);
  }

  async function upload() {
    if (!selectedFile || uploading) return;
    setUploading(true);
    setUploadError("");
    setUploadResult(null);
    setUploadProgress(0);

    try {
      let fileToUpload = selectedFile;
      if (isImage) {
        fileToUpload = await processImageFile(selectedFile, {
          format: outputFormat,
          cropMode,
          zoom,
          panX,
          panY,
        });
        const requestedStem = safeBaseName(fileName);
        fileToUpload = new File([fileToUpload], fileNameForFormat(requestedStem, outputFormat), {
          type: fileToUpload.type,
          lastModified: Date.now(),
        });
      } else if (isVideo && fileName && fileName !== selectedFile.name) {
        const stem = safeBaseName(fileName);
        const extension = fileExtension(selectedFile.name);
        fileToUpload = new File([selectedFile], `${stem}${extension}`, {
          type: selectedFile.type,
          lastModified: selectedFile.lastModified,
        });
      }

      const request = await fetch("/api/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: fileToUpload.name,
          contentType: fileToUpload.type,
          size: fileToUpload.size,
        }),
      });
      const data = await request.json();
      if (!request.ok) throw new Error(data.error || "Could not prepare the upload.");

      await xhrUpload(data.uploadUrl, fileToUpload, setUploadProgress);
      setUploadProgress(100);
      setUploadResult({ url: data.publicUrl, key: data.key, size: fileToUpload.size });
      setShareFile(fileToUpload);
      await loadLibrary();
    } catch (error) {
      setUploadError(error.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function copyUrl(url) {
    await navigator.clipboard.writeText(url);
    setCopyLabel("Copied");
    window.setTimeout(() => setCopyLabel("Copy URL"), 1400);
  }

  async function shareOrSave(file = shareFile) {
    if (!file) return;
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      try {
        await navigator.share({ files: [file], title: file.name });
        return;
      } catch (error) {
        if (error.name === "AbortError") return;
      }
    }
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function deleteItem(item) {
    if (!window.confirm(`Delete ${item.name}? This cannot be undone.`)) return;
    const response = await fetch("/api/media", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: item.key }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      window.alert(data.error || "Could not delete this file.");
      return;
    }
    setItems((current) => current.filter((existing) => existing.key !== item.key));
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Phone media utility</span>
          <h1>Media Hub</h1>
          <p>Upload something, grab the URL, move on.</p>
        </div>
      </header>

      <section className={styles.uploadHero}>
        <label className={styles.uploadButton}>
          <input type="file" accept="image/*,video/*" onChange={pickFile} />
          <span className={styles.uploadIcon}><UploadIcon /></span>
          <span className={styles.uploadCopy}>
            <strong>Upload photo or video</strong>
            <small>Choose from Photos, Camera, or Files</small>
          </span>
        </label>
      </section>

      {selectedFile && (
        <section id="edit-media" className={styles.editorSection}>
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>Selected media</span>
              <h2>Ready to upload</h2>
            </div>
            <button className={styles.textButton} type="button" onClick={clearSelection}>Cancel</button>
          </div>

          <div className={styles.editorGrid}>
            <div className={styles.previewCard}>
              <div
                className={`${styles.previewFrame} ${cropMode === "original" ? styles.previewOriginal : ""}`}
                style={{ aspectRatio: CROP_ASPECT[cropMode] }}
              >
                {isImage ? (
                  <img
                    src={previewUrl}
                    alt="Selected media preview"
                    style={{ transform: `translate(${panX * 0.12}%, ${panY * 0.12}%) scale(${zoom})` }}
                  />
                ) : (
                  <video src={previewUrl} controls playsInline preload="metadata" />
                )}
              </div>
              <div className={styles.fileSummary}>
                <strong>{selectedFile.name}</strong>
                <span>{formatBytes(selectedFile.size)}</span>
              </div>
            </div>

            <div className={styles.editorControls}>
              {isImage && (
                <>
                  <div className={styles.controlBlock}>
                    <span className={styles.controlLabel}>Crop</span>
                    <div className={styles.segmentedControl}>
                      {CROP_OPTIONS.map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          className={cropMode === value ? styles.segmentActive : ""}
                          onClick={() => {
                            setCropMode(value);
                            setZoom(1);
                            setPanX(0);
                            setPanY(0);
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.rangeGrid}>
                    <label><span>Zoom <small>{zoom.toFixed(1)}×</small></span><input type="range" min="1" max="3" step="0.1" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
                    <label><span>Horizontal <small>{panX}</small></span><input type="range" min="-100" max="100" step="1" value={panX} onChange={(event) => setPanX(Number(event.target.value))} /></label>
                    <label><span>Vertical <small>{panY}</small></span><input type="range" min="-100" max="100" step="1" value={panY} onChange={(event) => setPanY(Number(event.target.value))} /></label>
                  </div>

                  <div className={styles.controlBlock}>
                    <span className={styles.controlLabel}>Format</span>
                    <div className={styles.segmentedControl}>
                      {FORMAT_OPTIONS.map(([value, label]) => (
                        <button key={value} type="button" className={outputFormat === value ? styles.segmentActive : ""} onClick={() => setOutputFormat(value)}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <label className={styles.fieldLabel}>
                File name
                <input className={styles.textInput} value={fileName} onChange={(event) => setFileName(event.target.value)} spellCheck="false" />
              </label>

              {uploadError && <p className={styles.errorText}>{uploadError}</p>}

              {uploading && (
                <div className={styles.progressBlock}>
                  <div className={styles.progressLabels}><span>Uploading</span><span>{uploadProgress}%</span></div>
                  <div className={styles.progressTrack}><span style={{ width: `${uploadProgress}%` }} /></div>
                </div>
              )}

              <button className={styles.publishButton} type="button" onClick={upload} disabled={uploading}>
                <UploadIcon /> {uploading ? "Uploading…" : `Upload ${isVideo ? "Video" : "Image"}`}
              </button>
            </div>
          </div>

          {uploadResult && (
            <div className={styles.successCard}>
              <div>
                <span className={styles.successMark}>✓</span>
                <div>
                  <strong>Uploaded</strong>
                  <p>{uploadResult.url}</p>
                </div>
              </div>
              <div className={styles.successActions}>
                <button type="button" onClick={() => copyUrl(uploadResult.url)}><CopyIcon /> {copyLabel}</button>
                <button type="button" onClick={() => shareOrSave()}>Share / Save</button>
                <a href={uploadResult.url} target="_blank" rel="noreferrer">Open</a>
              </div>
            </div>
          )}
        </section>
      )}

      <section className={styles.librarySection}>
        <div className={styles.libraryHeader}>
          <div>
            <span className={styles.eyebrow}>S3 library</span>
            <h2>Your Media</h2>
            <p>{items.length ? `${items.length} file${items.length === 1 ? "" : "s"}` : "Everything in mobile-phone/"}</p>
          </div>
          <button className={styles.refreshButton} type="button" onClick={loadLibrary} aria-label="Refresh library"><RefreshIcon /></button>
        </div>

        <div className={styles.filterPills}>
          {["all", "image", "video"].map((value) => (
            <button key={value} type="button" className={filter === value ? styles.filterActive : ""} onClick={() => setFilter(value)}>
              {value === "all" ? "All" : value === "image" ? "Images" : "Videos"}
            </button>
          ))}
        </div>

        {libraryState === "loading" && <div className={styles.libraryMessage}>Loading media…</div>}
        {libraryError && <p className={styles.errorText}>{libraryError}</p>}
        {libraryState === "ready" && filteredItems.length === 0 && <div className={styles.emptyState}>No media here yet.</div>}

        <div className={styles.mediaGrid}>
          {filteredItems.map((item) => (
            <article className={styles.mediaCard} key={item.key}>
              <a className={styles.mediaPreview} href={item.url} target="_blank" rel="noreferrer">
                {item.type === "video" ? (
                  <video src={item.url} muted playsInline preload="metadata" />
                ) : (
                  <img src={item.url} alt={item.name} loading="lazy" />
                )}
                <span className={styles.typeBadge}>{item.type === "video" ? "Video" : "Image"}</span>
              </a>
              <div className={styles.mediaInfo}>
                <strong title={item.name}>{item.name}</strong>
                <span>{formatBytes(item.size)}{item.lastModified ? ` · ${new Date(item.lastModified).toLocaleDateString()}` : ""}</span>
              </div>
              <div className={styles.mediaActions}>
                <button type="button" onClick={() => copyUrl(item.url)}><CopyIcon /> Copy</button>
                <a href={item.url} target="_blank" rel="noreferrer">Open</a>
                <button className={styles.deleteButton} type="button" onClick={() => deleteItem(item)}><TrashIcon /> Delete</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
