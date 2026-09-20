import crypto from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isAuthenticated } from "@/lib/auth";
import {
  publicUrlForKey,
  s3,
  S3_BUCKET,
  S3_PREFIX,
  normalizePrefix,
} from "@/lib/s3";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024;

function sanitizeFileName(name) {
  const cleaned = String(name || "media")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120);
  return cleaned || "media";
}

function supportedContentType(type) {
  return typeof type === "string" && (type.startsWith("image/") || type.startsWith("video/"));
}

export async function POST(request) {
  if (!isAuthenticated(request)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { fileName, contentType, size } = body;

  if (!supportedContentType(contentType)) {
    return Response.json({ error: "Only image and video files are supported." }, { status: 400 });
  }

  if (!Number.isFinite(size) || size <= 0 || size > MAX_FILE_SIZE) {
    return Response.json({ error: "Invalid file size." }, { status: 400 });
  }

  const safeName = sanitizeFileName(fileName);
  const dot = safeName.lastIndexOf(".");
  const stem = dot > 0 ? safeName.slice(0, dot) : safeName;
  const extension = dot > 0 ? safeName.slice(dot) : "";
  const unique = crypto.randomUUID().slice(0, 8);
  const key = `${normalizePrefix(S3_PREFIX)}${stem}-${Date.now()}-${unique}${extension}`;

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });

  return Response.json({
    uploadUrl,
    key,
    publicUrl: publicUrlForKey(key),
  });
}
