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

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12 4 4L19 6" />
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

function validNotesReturn(value) {
  try {
    const target = new URL(value);
    const host = target.hostname.toLowerCase();
    const isLocal = host === "localhost" || host === "127.0.0.1";
    const isKnownHost = host.endsWith(".amplifyapp.com") || host === "nicholasegner.com" || host.endsWith(".nicholasegner.com");
    const validProtocol = target.protocol === "https:" || (isLocal && target.protocol === "http:");
    if (!validProtocol || (!isKnownHost && !isLocal) || !target.pathname.startsWith("/file/")) return null;
    return target;
  } catch {
    return null;
  }
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
  const [activeItem, setActiveItem] = useState(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const [bulkCopyLabel, setBulkCopyLabel] = useState("Copy URLs");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [viewerBusy, setViewerBusy] = useState(false);
  const [notesContext, setNotesContext] = useState(null);

  const isImage = selectedFile?.type?.startsWith("image/");
  const isVideo = selectedFile?.type?.startsWith("video/");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("source") !== "notes") return;

    const draftKey = params.get("draftKey");
    const returnTarget = validNotesReturn(params.get("returnTo"));
    if (!draftKey || !returnTarget) return;

    setNotesContext({
      draftKey,
      returnTo: returnTarget.toString(),
    });
  }, []);

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

  useEffect(() => {
    if (!activeItem) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape") setActiveItem(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeItem]);

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

  const selectedItems = useMemo(
    () => items.filter((item) => selectedKeys.has(item.key)),
    [items, selectedKeys],
  );

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

  function returnToNotes(item = null) {
    if (!notesContext) return;
    const target = validNotesReturn(notesContext.returnTo);
    if (!target) {
      window.alert("The Notes Hub return address is no longer valid.");
      return;
    }

    target.searchParams.set("mediaReturn", "1");
    target.searchParams.set("draftKey", notesContext.draftKey);

    if (item) {
      target.searchParams.set("mediaUrl", item.url);
      target.searchParams.set("mediaType", item.type || "image");
      target.searchParams.set("mediaName", item.name || "media");
    }

    window.location.assign(target.toString());
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
      const resultItem = {
        url: data.publicUrl,
        key: data.key,
        name: fileToUpload.name,
        size: fileToUpload.size,
        type: fileToUpload.type.startsWith("video/") ? "video" : "image",
        lastModified: new Date().toISOString(),
      };
      setUploadResult(resultItem);
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

  async function shareLibraryItem(item) {
    if (!item || viewerBusy) return;
    setViewerBusy(true);
    try {
      const response = await fetch(item.url);
      if (!response.ok) throw new Error("Could not download this file.");
      const blob = await response.blob();
      const file = new File([blob], item.name, { type: blob.type || "application/octet-stream" });
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        try {
          await navigator.share({ files: [file], title: item.name });
          return;
        } catch (error) {
          if (error.name === "AbortError") return;
        }
      }
      const url = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = item.name;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      window.alert(error.message || "Could not share this file.");
    } finally {
      setViewerBusy(false);
    }
  }

  async function deleteFromS3(item) {
    const response = await fetch("/api/media", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: item.key }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Could not delete ${item.name}.`);
  }

  async function deleteItem(item) {
    if (!window.confirm(`Delete ${item.name}? This cannot be undone.`)) return;
    try {
      await deleteFromS3(item);
      setItems((current) => current.filter((existing) => existing.key !== item.key));
      setSelectedKeys((current) => {
        const next = new Set(current);
        next.delete(item.key);
        return next;
      });
      if (activeItem?.key === item.key) setActiveItem(null);
    } catch (error) {
      window.alert(error.message || "Could not delete this file.");
    }
  }

  function toggleSelected(item) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(item.key)) next.delete(item.key);
      else next.add(item.key);
      return next;
    });
  }

  function toggleSelectMode() {
    if (selecting) setSelectedKeys(new Set());
    setSelecting((current) => !current);
  }

  async function copySelectedUrls() {
    const urls = selectedItems.map((item) => item.url);
    if (!urls.length) return;
    await navigator.clipboard.writeText(JSON.stringify(urls, null, 2));
    setBulkCopyLabel("Copied");
    window.setTimeout(() => setBulkCopyLabel("Copy URLs"), 1400);
  }

  async function deleteSelected() {
    if (!selectedItems.length || bulkDeleting) return;
    const count = selectedItems.length;
    if (!window.confirm(`Delete ${count} selected file${count === 1 ? "" : "s"}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      for (const item of selectedItems) {
        await deleteFromS3(item);
      }
      const keys = new Set(selectedItems.map((item) => item.key));
      setItems((current) => current.filter((item) => !keys.has(item.key)));
      setSelectedKeys(new Set());
      setSelecting(false);
    } catch (error) {
      window.alert(error.message || "Could not delete all selected files.");
      await loadLibrary();
    } finally {
      setBulkDeleting(false);
    }
  }

  function openItem(item) {
    if (selecting) {
      toggleSelected(item);
      return;
    }
    setCopyLabel("Copy URL");
    setActiveItem(item);
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

      {notesContext && (
        <section className={styles.successCard} aria-label="Notes Hub media picker">
          <div>
            <span className={styles.successMark}>N</span>
            <div>
              <strong>Choosing media for Notes Hub</strong>
              <p>Upload something new or choose an existing file, then tap Use in Notes.</p>
            </div>
          </div>
          <div className={styles.successActions}>
            <button type="button" onClick={() => returnToNotes()}>Back to Notes</button>
          </div>
        </section>
      )}

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
                {notesContext && <button type="button" onClick={() => returnToNotes(uploadResult)}>Use in Notes</button>}
                <button type="button" onClick={() => copyUrl(uploadResult.url)}><CopyIcon /> {copyLabel}</button>
                <button type="button" onClick={() => shareOrSave()}>Share / Save</button>
                <button type="button" onClick={() => setActiveItem(uploadResult)}>Preview</button>
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
          <div className={styles.libraryTools}>
            <button className={`${styles.selectButton} ${selecting ? styles.selectButtonActive : ""}`} type="button" onClick={toggleSelectMode}>
              {selecting ? "Done" : "Select"}
            </button>
            <button className={styles.refreshButton} type="button" onClick={loadLibrary} aria-label="Refresh library"><RefreshIcon /></button>
          </div>
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
          {filteredItems.map((item) => {
            const isSelected = selectedKeys.has(item.key);
            return (
              <article className={`${styles.mediaCard} ${isSelected ? styles.selectedCard : ""}`} key={item.key}>
                <button className={styles.mediaPreview} type="button" onClick={() => openItem(item)} aria-label={selecting ? `${isSelected ? "Deselect" : "Select"} ${item.name}` : `Preview ${item.name}`}>
                  {item.type === "video" ? (
                    <video src={item.url} muted playsInline preload="metadata" />
                  ) : (
                    <img src={item.url} alt={item.name} loading="lazy" />
                  )}
                  <span className={styles.typeBadge}>{item.type === "video" ? "Video" : "Image"}</span>
                  {selecting && (
                    <span className={`${styles.selectionCheck} ${isSelected ? styles.selectionCheckActive : ""}`}>
                      {isSelected && <CheckIcon />}
                    </span>
                  )}
                </button>
                <div className={styles.mediaInfo}>
                  <strong title={item.name}>{item.name}</strong>
                  <span>{formatBytes(item.size)}{item.lastModified ? ` · ${new Date(item.lastModified).toLocaleDateString()}` : ""}</span>
                </div>
                {!selecting && (
                  <div className={styles.mediaActions}>
                    {notesContext && <button type="button" onClick={() => returnToNotes(item)}>Use in Notes</button>}
                    <button type="button" onClick={() => copyUrl(item.url)}><CopyIcon /> Copy</button>
                    <button type="button" onClick={() => setActiveItem(item)}>View</button>
                    <button className={styles.deleteButton} type="button" onClick={() => deleteItem(item)}><TrashIcon /> Delete</button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {selecting && (
        <div className={styles.bulkBar}>
          <div>
            <strong>{selectedItems.length} selected</strong>
            <span>Tap files to add or remove</span>
          </div>
          <div className={styles.bulkActions}>
            <button type="button" onClick={copySelectedUrls} disabled={!selectedItems.length}><CopyIcon /> {bulkCopyLabel}</button>
            <button className={styles.bulkDelete} type="button" onClick={deleteSelected} disabled={!selectedItems.length || bulkDeleting}><TrashIcon /> {bulkDeleting ? "Deleting…" : "Delete"}</button>
          </div>
        </div>
      )}

      {activeItem && (
        <div className={styles.viewerBackdrop} role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setActiveItem(null);
        }}>
          <section className={styles.viewer} role="dialog" aria-modal="true" aria-label={`Preview ${activeItem.name}`}>
            <div className={styles.viewerTopbar}>
              <div>
                <strong>{activeItem.name}</strong>
                <span>{formatBytes(activeItem.size)}</span>
              </div>
              <button type="button" onClick={() => setActiveItem(null)} aria-label="Close preview"><CloseIcon /></button>
            </div>

            <div className={styles.viewerMedia}>
              {activeItem.type === "video" ? (
                <video src={activeItem.url} controls playsInline preload="metadata" />
              ) : (
                <img src={activeItem.url} alt={activeItem.name} />
              )}
            </div>

            <div className={styles.viewerActions}>
              {notesContext && <button type="button" onClick={() => returnToNotes(activeItem)}>Use in Notes</button>}
              <button type="button" onClick={() => copyUrl(activeItem.url)}><CopyIcon /> {copyLabel}</button>
              <button type="button" onClick={() => shareLibraryItem(activeItem)} disabled={viewerBusy}>{viewerBusy ? "Preparing…" : "Share / Save"}</button>
              <a href={activeItem.url} target="_blank" rel="noreferrer">Open in Browser</a>
              <button className={styles.viewerDelete} type="button" onClick={() => deleteItem(activeItem)}><TrashIcon /> Delete</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
