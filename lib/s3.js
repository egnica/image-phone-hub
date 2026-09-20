import { S3Client } from "@aws-sdk/client-s3";

export const S3_BUCKET = process.env.S3_BUCKET || "latestartbucket";
export const S3_PREFIX = process.env.S3_PREFIX || "mobile-phone/";
export const S3_REGION = process.env.S3_REGION || "us-east-2";
export const MEDIA_BASE_URL = (
  process.env.MEDIA_BASE_URL ||
  `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com`
).replace(/\/$/, "");

export const s3 = new S3Client({ region: S3_REGION });

export function publicUrlForKey(key) {
  const encodedKey = key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${MEDIA_BASE_URL}/${encodedKey}`;
}

export function normalizePrefix(prefix = S3_PREFIX) {
  return prefix.endsWith("/") ? prefix : `${prefix}/`;
}

export function keyIsAllowed(key) {
  return typeof key === "string" && key.startsWith(normalizePrefix());
}
