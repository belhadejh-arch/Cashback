import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { Storage, type File } from "@google-cloud/storage";
import { createRenderDiskUploadUrl, getRenderDiskObjectFile } from "./renderDiskStorage";

const SIDECAR = "http://127.0.0.1:1106";
export type PrivateMediaFile = {
  getMetadata(): Promise<[{ contentType?: unknown; size?: unknown }]>;
  download(): Promise<[Buffer]>;
  createReadStream(): Readable;
};

const storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${SIDECAR}/token`,
    type: "external_account",
    credential_source: {
      url: `${SIDECAR}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

function bucketPrefix(): string {
  const directory = process.env.PRIVATE_OBJECT_DIR;
  if (!directory) throw new Error("PRIVATE_OBJECT_DIR is not configured");
  return directory.startsWith("/") ? directory : `/${directory}`;
}

function parseStoragePath(fullPath: string): { bucketName: string; objectName: string } {
  const parts = fullPath.replace(/^\/+/, "").split("/");
  if (parts.length < 2 || !parts[0] || !parts.slice(1).join("/")) {
    throw new Error("Invalid object storage path");
  }
  return { bucketName: parts[0], objectName: parts.slice(1).join("/") };
}

async function signUpload(bucketName: string, objectName: string): Promise<string> {
  const response = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: objectName,
      method: "PUT",
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Could not create upload URL (${response.status})`);
  const result = (await response.json()) as { signed_url?: string };
  if (!result.signed_url) throw new Error("Upload URL was not returned");
  return result.signed_url;
}

function createUploadUrl(
  uploaderUid: string,
  objectName: string,
  contentType: string,
  size: number,
): Promise<string> {
  if (process.env.APP_STORAGE_DRIVER === "render-disk") {
    return Promise.resolve(createRenderDiskUploadUrl(uploaderUid, objectName, contentType, size));
  }
  const fullPath = `${bucketPrefix()}/${objectName}`;
  const { bucketName, objectName: storageObjectName } = parseStoragePath(fullPath);
  return signUpload(bucketName, storageObjectName);
}

export async function createProfilePhotoUpload(uid: string, contentType: string, size: number): Promise<{
  uploadURL: string;
  objectPath: string;
}> {
  const objectName = `profile-photos/${uid}/${randomUUID()}`;
  return {
    uploadURL: await createUploadUrl(uid, objectName, contentType, size),
    objectPath: `/objects/${objectName}`,
  };
}

export async function createReceiptPhotoUpload(
  uid: string,
  uploadId: string,
  contentType: string,
  size: number,
): Promise<{ uploadURL: string; objectPath: string }> {
  const objectName = `receipt-images/${uid}/${uploadId}`;
  return {
    uploadURL: await createUploadUrl(uid, objectName, contentType, size),
    objectPath: `/objects/${objectName}`,
  };
}

export async function createMerchantAssetUpload(
  uid: string,
  merchantId: string,
  asset: "logo" | "cover" | "topup-proof" | "withdrawal-proof",
  uploadId: string,
  contentType: string,
  size: number,
  uploaderUid = uid,
): Promise<{ uploadURL: string; objectPath: string }> {
  const objectName = `merchant-assets/${merchantId}/${asset}/${uid}/${uploadId}`;
  return {
    uploadURL: await createUploadUrl(uploaderUid, objectName, contentType, size),
    objectPath: `/objects/${objectName}`,
  };
}

export async function getProfilePhotoFile(objectPath: string): Promise<PrivateMediaFile> {
  if (!objectPath.startsWith("/objects/")) throw new Error("Invalid object path");
  if (process.env.APP_STORAGE_DRIVER === "render-disk") {
    return getRenderDiskObjectFile(objectPath);
  }
  const { bucketName, objectName } = parseStoragePath(
    `${bucketPrefix()}/${objectPath.slice("/objects/".length)}`,
  );
  const file = storage.bucket(bucketName).file(objectName);
  const [exists] = await file.exists();
  if (!exists) throw new Error("Profile photo not found");
  return {
    async getMetadata() {
      const [metadata] = await file.getMetadata();
      return [metadata as { contentType?: unknown; size?: unknown }];
    },
    async download() {
      const [buffer] = await file.download();
      return [buffer];
    },
    createReadStream() {
      return file.createReadStream();
    },
  };
}

export async function readPrivateImage(
  objectPath: string,
  maxBytes = 5 * 1024 * 1024,
): Promise<{ buffer: Buffer; contentType: string; size: number }> {
  const file = await getProfilePhotoFile(objectPath);
  const [metadata] = await file.getMetadata();
  const contentType = String(metadata.contentType ?? "");
  const size = Number(metadata.size ?? 0);
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(contentType) ||
    !Number.isFinite(size) ||
    size <= 0 ||
    size > maxBytes
  ) {
    throw new Error("Invalid uploaded image metadata");
  }
  const [buffer] = await file.download();
  if (buffer.length !== size || !imageBufferMatchesType(buffer, contentType)) {
    throw new Error("Uploaded image content does not match its content type");
  }
  return { buffer, contentType, size };
}

function imageBufferMatchesType(buffer: Buffer, contentType: string): boolean {
  if (contentType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (contentType === "image/png") {
    return buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  return buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP";
}

export async function readProfilePhoto(
  objectPath: string,
): Promise<{ body: Readable; contentType: string; size: number }> {
  const file = await getProfilePhotoFile(objectPath);
  const [metadata] = await file.getMetadata();
  const contentType = String(metadata.contentType ?? "");
  const size = Number(metadata.size ?? 0);
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(contentType) ||
    !Number.isFinite(size) ||
    size <= 0 ||
    size > 5 * 1024 * 1024
  ) {
    throw new Error("Invalid profile photo metadata");
  }
  return { body: file.createReadStream(), contentType, size };
}

export async function profilePhotoMatchesType(
  file: PrivateMediaFile,
  contentType: string,
): Promise<boolean> {
  const [buffer] = await file.download();
  if (contentType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (contentType === "image/png") {
    return buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (contentType === "image/webp") {
    return buffer.length >= 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP";
  }
  return false;
}
