import { DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import {
  keyIsAllowed,
  publicUrlForKey,
  s3,
  S3_BUCKET,
  S3_PREFIX,
  normalizePrefix,
} from "@/lib/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mediaTypeForKey(key) {
  const lower = key.toLowerCase();
  if (/\.(mp4|mov|m4v|webm|avi)$/i.test(lower)) return "video";
  return "image";
}

export async function GET() {
  const prefix = normalizePrefix(S3_PREFIX);
  const contents = [];
  let continuationToken;

  do {
    const result = await s3.send(
      new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    contents.push(...(result.Contents || []));
    continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
  } while (continuationToken);

  const items = contents
    .filter((item) => item.Key && item.Key !== prefix)
    .map((item) => ({
      key: item.Key,
      name: item.Key.split("/").pop(),
      size: item.Size || 0,
      lastModified: item.LastModified?.toISOString() || null,
      type: mediaTypeForKey(item.Key),
      url: publicUrlForKey(item.Key),
    }))
    .sort((a, b) => new Date(b.lastModified || 0) - new Date(a.lastModified || 0));

  return Response.json({ items });
}

export async function DELETE(request) {
  const body = await request.json().catch(() => ({}));
  const key = body.key;
  if (!keyIsAllowed(key)) {
    return Response.json({ error: "Invalid media key." }, { status: 400 });
  }

  await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  return Response.json({ deleted: true });
}
