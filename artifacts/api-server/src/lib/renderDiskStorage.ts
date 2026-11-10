import { randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Request } from "express";
import type { PrivateMediaFile } from "./profilePhotoStorage";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const UPLOAD_TTL_MS = 10 * 60 * 1000;

type UploadGrant = {
  uploaderUid: string;
  objectName: string;
  contentType: string;
  maxBytes: number;
  expiresAt: number;
};

const uploadGrants = new Map<string, UploadGrant>();

function storageRoot(): string {
  const configured = process.env.APP_STORAGE_DIR;
  if (!configured || !path.isAbsolute(configured)) {
    throw new Error("APP_STORAGE_DIR must be an absolute path for Render disk storage");
  }
  return path.resolve(configured);
}

function resolveObjectName(objectName: string): string {
  if (
    !objectName ||
    objectName.startsWith("/") ||
    objectName.includes("\\") ||
    objectName.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error("Invalid object name");
  }
  const root = storageRoot();
  const target = path.resolve(root, ...objectName.split("/"));
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error("Invalid object name");
  return target;
}

function matchesImage(buffer: Buffer, contentType: string): boolean {
  if (contentType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (contentType === "image/png") {
    return buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  return contentType === "image/webp" &&
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP";
}

export function createRenderDiskUploadUrl(
  uploaderUid: string,
  objectName: string,
  contentType: string,
  declaredSize: number,
): string {
  if (
    !uploaderUid ||
    !["image/jpeg", "image/png", "image/webp"].includes(contentType) ||
    !Number.isInteger(declaredSize) ||
    declaredSize < 1 ||
    declaredSize > MAX_IMAGE_BYTES
  ) {
    throw new Error("Invalid disk upload request");
  }
  resolveObjectName(objectName);
  const now = Date.now();
  for (const [token, grant] of uploadGrants) {
    if (grant.expiresAt <= now) uploadGrants.delete(token);
  }
  const token = randomBytes(32).toString("base64url");
  uploadGrants.set(token, {
    uploaderUid,
    objectName,
    contentType,
    maxBytes: declaredSize,
    expiresAt: now + UPLOAD_TTL_MS,
  });
  return `/api/cashback/storage/uploads/${token}`;
}

export async function receiveRenderDiskUpload(
  token: string,
  uploaderUid: string,
  contentType: string,
  request: Request,
): Promise<
  | { ok: true }
  | { ok: false; status: number; error: string }
  | null
> {
  if (process.env.APP_STORAGE_DRIVER !== "render-disk") return null;
  const grant = uploadGrants.get(token);
  if (!grant) return { ok: false, status: 404, error: "UPLOAD_NOT_FOUND" };
  if (grant.expiresAt <= Date.now()) {
    uploadGrants.delete(token);
    return { ok: false, status: 410, error: "UPLOAD_EXPIRED" };
  }
  if (grant.uploaderUid !== uploaderUid) {
    return { ok: false, status: 403, error: "UPLOAD_FORBIDDEN" };
  }
  uploadGrants.delete(token);
  if (grant.contentType !== contentType) {
    return { ok: false, status: 400, error: "INVALID_IMAGE" };
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > grant.maxBytes || totalBytes > MAX_IMAGE_BYTES) {
      return { ok: false, status: 413, error: "IMAGE_TOO_LARGE" };
    }
    chunks.push(buffer);
  }
  const image = Buffer.concat(chunks, totalBytes);
  if (!image.length || !matchesImage(image, grant.contentType)) {
    return { ok: false, status: 400, error: "INVALID_IMAGE" };
  }

  const target = resolveObjectName(grant.objectName);
  const metadataPath = `${target}.meta.json`;
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  let objectCreated = false;
  try {
    await writeFile(target, image, { flag: "wx", mode: 0o600 });
    objectCreated = true;
    await writeFile(
      metadataPath,
      JSON.stringify({ contentType: grant.contentType, size: image.length }),
      { flag: "wx", mode: 0o600 },
    );
  } catch (error) {
    if (objectCreated) await rm(target, { force: true });
    throw error;
  }
  return { ok: true };
}

export async function getRenderDiskObjectFile(objectPath: string): Promise<PrivateMediaFile> {
  if (!objectPath.startsWith("/objects/")) throw new Error("Invalid object path");
  const objectName = objectPath.slice("/objects/".length);
  const target = resolveObjectName(objectName);
  const info = await stat(target);
  if (!info.isFile()) throw new Error("Stored object is not a file");

  return {
    async getMetadata() {
      const [metadata, current] = await Promise.all([
        readFile(`${target}.meta.json`, "utf8").then((value) => JSON.parse(value) as {
          contentType?: unknown;
        }),
        stat(target),
      ]);
      return [{
        contentType: metadata.contentType,
        size: current.size,
      }];
    },
    async download() {
      return [await readFile(target)];
    },
    createReadStream() {
      return createReadStream(target);
    },
  };
}
