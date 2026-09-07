import { ApiError } from "@/lib/domain";

export const DEFAULT_JSON_BODY_BYTES = 65_536;
export const MCP_JSON_BODY_BYTES = 1_048_576;

/** Bound bytes while streaming; Content-Length alone is not a security boundary. */
async function readBoundedBytes(
  request: Request,
  maxBodyBytes = DEFAULT_JSON_BODY_BYTES,
): Promise<Uint8Array> {
  const tooLarge = () =>
    new ApiError(413, "BODY_TOO_LARGE", "Request body exceeds the size limit");
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBodyBytes) throw tooLarge();
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBodyBytes) {
        await reader.cancel();
        throw tooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

export async function readBoundedJson(
  request: Request,
  maxBodyBytes = DEFAULT_JSON_BODY_BYTES,
): Promise<unknown> {
  return JSON.parse(
    Buffer.from(await readBoundedBytes(request, maxBodyBytes)).toString("utf8"),
  );
}

export async function readBoundedFormData(request: Request): Promise<FormData> {
  const bytes = await readBoundedBytes(request);
  return new Response(new Uint8Array(bytes), {
    headers: { "content-type": request.headers.get("content-type") ?? "" },
  }).formData();
}
