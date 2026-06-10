import { randomUUID } from "crypto";
import { SUPPORT_ALLOWED_IMAGE_TYPES, SUPPORT_MAX_ATTACHMENT_BYTES } from "@/lib/support";

const MAGIC: { mime: (typeof SUPPORT_ALLOWED_IMAGE_TYPES)[number]; bytes: number[] }[] = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF....WEBP checked below
];

export interface ValidatedAttachment {
  buffer: Buffer;
  mime: (typeof SUPPORT_ALLOWED_IMAGE_TYPES)[number];
  extension: string;
}

function detectImageType(buffer: Buffer): ValidatedAttachment | null {
  if (buffer.length < 12) return null;

  for (const sig of MAGIC) {
    if (sig.bytes.every((b, i) => buffer[i] === b)) {
      if (sig.mime === "image/webp") {
        const webp =
          buffer[8] === 0x57 &&
          buffer[9] === 0x45 &&
          buffer[10] === 0x42 &&
          buffer[11] === 0x50;
        if (!webp) continue;
      }
      const extension =
        sig.mime === "image/jpeg"
          ? "jpg"
          : sig.mime === "image/png"
            ? "png"
            : "webp";
      return { buffer, mime: sig.mime, extension };
    }
  }
  return null;
}

export function validateSupportAttachment(
  file: File | { buffer: Buffer; mime: string; size: number }
): ValidatedAttachment {
  const buffer = "buffer" in file ? file.buffer : Buffer.from([]);
  const size = "buffer" in file ? file.size : file.size;
  const declaredMime = "buffer" in file ? file.mime : file.type;

  if (size <= 0 || size > SUPPORT_MAX_ATTACHMENT_BYTES) {
    throw new Error("Each screenshot must be 4 MB or smaller");
  }

  if (
    !SUPPORT_ALLOWED_IMAGE_TYPES.includes(
      declaredMime as (typeof SUPPORT_ALLOWED_IMAGE_TYPES)[number]
    )
  ) {
    throw new Error("Only JPEG, PNG, or WebP images are allowed");
  }

  const data =
    "buffer" in file
      ? file.buffer
      : null;

  if (!data) {
    throw new Error("Invalid file");
  }

  const detected = detectImageType(data);
  if (!detected) {
    throw new Error("File content does not match a valid image format");
  }

  if (detected.mime !== declaredMime) {
    throw new Error("File type does not match file contents");
  }

  return detected;
}

export async function fileToBuffer(file: File): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export function buildAttachmentStoragePath(
  userId: string,
  extension: string
): string {
  const safeExt = extension.replace(/[^a-z]/gi, "").slice(0, 4) || "bin";
  return `support-tickets/${userId}/${randomUUID()}.${safeExt}`;
}

/** Only paths uploaded by this user under support-tickets/{uid}/ */
export function isOwnedAttachmentPath(path: string, userId: string): boolean {
  const prefix = `support-tickets/${userId}/`;
  if (!path.startsWith(prefix)) return false;
  const rest = path.slice(prefix.length);
  return /^[a-f0-9-]{36}\.(jpg|png|webp)$/i.test(rest);
}
