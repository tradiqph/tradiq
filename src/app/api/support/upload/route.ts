import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/api-auth";
import { getAdminStorageBucket } from "@/lib/firebase/admin";
import {
  buildAttachmentStoragePath,
  fileToBuffer,
  validateSupportAttachment,
} from "@/lib/support-attachments";
import { SUPPORT_MAX_ATTACHMENTS } from "@/lib/support";
import { apiBadRequest, apiError } from "@/lib/security/api-errors";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

export async function POST(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request);
  const limit = checkRateLimit({
    scope: "support-upload",
    key: `${decoded.uid}:${ip}`,
    limit: 15,
    windowSec: 3600,
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many uploads" }, { status: 429 });
  }

  const bucket = getAdminStorageBucket();
  if (!bucket) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiBadRequest("Invalid form data");
  }

  const files = formData.getAll("file").filter((f) => f instanceof File) as File[];
  if (files.length === 0) {
    return apiBadRequest("No file provided");
  }
  if (files.length > 1) {
    return apiBadRequest("Upload one file at a time");
  }

  const file = files[0];
  try {
    const buffer = await fileToBuffer(file);
    const validated = validateSupportAttachment({
      buffer,
      mime: file.type,
      size: file.size,
    });

    const path = buildAttachmentStoragePath(decoded.uid, validated.extension);
    const gcsFile = bucket.file(path);

    await gcsFile.save(validated.buffer, {
      metadata: {
        contentType: validated.mime,
        metadata: {
          uploadedBy: decoded.uid,
          purpose: "support-ticket",
        },
      },
      resumable: false,
    });

    return NextResponse.json({
      path,
      maxAttachments: SUPPORT_MAX_ATTACHMENTS,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    return apiBadRequest(msg);
  }
}
