import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { Storage, type File } from "@google-cloud/storage";

const SIDECAR = "http://127.0.0.1:1106";
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

export async function createProfilePhotoUpload(uid: string): Promise<{
  uploadURL: string;
  objectPath: string;
}> {
  const fullPath = `${bucketPrefix()}/profile-photos/${uid}/${randomUUID()}`;
  const { bucketName, objectName } = parseStoragePath(fullPath);
  return {
    uploadURL: await signUpload(bucketName, objectName),
    objectPath: `/objects/${objectName}`,
  };
}

export async function getProfilePhotoFile(objectPath: string): Promise<File> {
  if (!objectPath.startsWith("/objects/")) throw new Error("Invalid object path");
  const { bucketName, objectName } = parseStoragePath(
    `${bucketPrefix()}/${objectPath.slice("/objects/".length)}`,
  );
  const file = storage.bucket(bucketName).file(objectName);
  const [exists] = await file.exists();
  if (!exists) throw new Error("Profile photo not found");
  return file;
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
  file: File,
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
