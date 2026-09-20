# Media Hub

A mobile-first Next.js utility for uploading website-ready images and videos from a phone to S3.

## Storage

- Bucket: `latestartbucket`
- Prefix: `mobile-phone/`
- Default region: `us-east-2`
- Amplify Hosting uses the `image-phone-hub-amplify-role` compute role. The role is scoped to list, read, upload, and delete only under the `mobile-phone/` prefix.

## Features

- Private password screen with a 30-day signed session cookie
- Direct-to-S3 presigned uploads for images and videos
- Image crop presets: original, 1:1, 4:5, and 16:9
- Image zoom and horizontal/vertical crop positioning
- WebP, JPEG, and PNG output
- Upload progress
- Copy public URL
- iOS share sheet / Save Image or Save Video workflow
- Media library with image/video filtering
- Open, copy, and delete actions
- iPhone home-screen metadata and icon

## Amplify environment variables

Required:

```text
MEDIA_HUB_PASSWORD=<your private app password>
```

Optional overrides:

```text
S3_BUCKET=latestartbucket
S3_PREFIX=mobile-phone/
S3_REGION=us-east-2
MEDIA_BASE_URL=https://latestartbucket.s3.us-east-2.amazonaws.com
```

`MEDIA_BASE_URL` can later be changed to a CloudFront or custom-domain base URL without changing stored object keys.

## S3 browser upload requirement

Uploads are sent directly from the browser to the presigned S3 URL. The bucket needs a CORS rule that allows `PUT` requests from the Amplify app origin. Keep that rule limited to the actual production origin when possible.

Example:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedOrigins": ["https://main.d79ps74xfj764.amplifyapp.com"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

## Development

```bash
npm install
npm run dev
```
