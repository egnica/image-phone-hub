const ASPECTS = {
  original: null,
  square: 1,
  portrait: 4 / 5,
  landscape: 16 / 9,
};

const FORMATS = {
  webp: { mime: "image/webp", extension: "webp", quality: 0.86 },
  jpeg: { mime: "image/jpeg", extension: "jpg", quality: 0.9 },
  png: { mime: "image/png", extension: "png", quality: undefined },
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This image could not be opened by the browser."));
    };
    image.src = url;
  });
}

export function extensionForFormat(format) {
  return FORMATS[format]?.extension || "webp";
}

export function fileNameForFormat(fileName, format) {
  const stem = String(fileName || "image").replace(/\.[^.]+$/, "") || "image";
  return `${stem}.${extensionForFormat(format)}`;
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

export async function processImageFile(file, options = {}) {
  const format = options.format || "webp";
  const cropMode = options.cropMode || "original";
  const zoom = clamp(Number(options.zoom) || 1, 1, 3);
  const panX = clamp(Number(options.panX) || 0, -100, 100);
  const panY = clamp(Number(options.panY) || 0, -100, 100);
  const maxDimension = clamp(Number(options.maxDimension) || 4096, 512, 8192);
  const definition = FORMATS[format] || FORMATS.webp;
  const image = await loadImage(file);

  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  if (!sourceWidth || !sourceHeight) {
    throw new Error("The image dimensions could not be read.");
  }

  const targetAspect = ASPECTS[cropMode];
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;

  if (targetAspect) {
    const sourceAspect = sourceWidth / sourceHeight;
    if (sourceAspect > targetAspect) {
      cropWidth = sourceHeight * targetAspect;
      cropHeight = sourceHeight;
    } else {
      cropWidth = sourceWidth;
      cropHeight = sourceWidth / targetAspect;
    }
  }

  cropWidth /= zoom;
  cropHeight /= zoom;

  const availableX = Math.max(0, sourceWidth - cropWidth);
  const availableY = Math.max(0, sourceHeight - cropHeight);
  const sourceX = clamp(availableX / 2 + (panX / 100) * (availableX / 2), 0, availableX);
  const sourceY = clamp(availableY / 2 + (panY / 100) * (availableY / 2), 0, availableY);

  const scale = Math.min(1, maxDimension / Math.max(cropWidth, cropHeight));
  const outputWidth = Math.max(1, Math.round(cropWidth * scale));
  const outputHeight = Math.max(1, Math.round(cropHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d", { alpha: format === "png" });
  if (!context) throw new Error("Image processing is not available in this browser.");

  if (format === "jpeg") {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, outputWidth, outputHeight);
  }

  context.drawImage(
    image,
    sourceX,
    sourceY,
    cropWidth,
    cropHeight,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, definition.mime, definition.quality);
  });

  if (!blob) throw new Error(`Could not create a ${format.toUpperCase()} image.`);

  return new File([blob], fileNameForFormat(file.name, format), {
    type: definition.mime,
    lastModified: Date.now(),
  });
}
