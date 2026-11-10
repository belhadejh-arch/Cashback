export type FileDeliveryResult = "shared" | "downloaded" | "cancelled";

function isShareCancellation(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export async function deliverFile(
  blob: Blob,
  filename: string,
): Promise<FileDeliveryResult> {
  const shareNavigator = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };
  let file: File | undefined;
  let canShareFile = false;
  if (typeof File !== "undefined") {
    file = new File([blob], filename, {
      type: blob.type || "application/octet-stream",
    });
    try {
      canShareFile =
        typeof shareNavigator.share === "function" &&
        typeof shareNavigator.canShare === "function" &&
        shareNavigator.canShare({ files: [file] });
    } catch {
      canShareFile = false;
    }
  }

  if (canShareFile && file) {
    try {
      await shareNavigator.share({ title: filename, files: [file] });
      return "shared";
    } catch (error) {
      if (isShareCancellation(error)) return "cancelled";
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.dataset.testid = "link-file-download";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return "downloaded";
}
