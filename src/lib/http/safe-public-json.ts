import { lookup } from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";

export class UnsafePublicUrlError extends Error {}

/** Conservative public-unicast policy. Special, mapped and transition ranges fail closed. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const [a = 0, b = 0, c = 0] = address.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  if (family !== 6) return false;
  // WHATWG URL canonicalizes zero compression and IPv4-mapped representations.
  const normalized = new URL(`https://[${address}]/`).hostname.slice(1, -1);
  const first = Number.parseInt(normalized.split(":")[0] ?? "0", 16);
  return (
    first >= 0x2000 &&
    first <= 0x3fff &&
    !normalized.startsWith("2001:") &&
    !normalized.startsWith("2002:") &&
    !normalized.startsWith("3fff:")
  );
}

/** HTTPS keeps original hostname/TLS validation, but socket DNS is pinned to the checked IP. */
export async function fetchPublicJson(
  url: URL,
  maxBytes = 65_536,
  timeoutMs = 3_500,
): Promise<unknown> {
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    hostname === "localhost" ||
    /\.(localhost|local|internal)$/i.test(hostname)
  ) {
    throw new UnsafePublicUrlError("Unsafe public URL");
  }
  const signal = AbortSignal.timeout(timeoutMs);
  const addresses = await new Promise<LookupAddress[]>((resolve, reject) => {
    const abort = () => reject(new Error("Public lookup timed out"));
    signal.addEventListener("abort", abort, { once: true });
    const result = isIP(hostname)
      ? Promise.resolve([{ address: hostname, family: isIP(hostname) }])
      : lookup(hostname, { all: true, verbatim: true });
    result
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
  const candidates = addresses;
  if (
    !candidates.length ||
    candidates.some(({ address }) => !isPublicAddress(address))
  ) {
    throw new UnsafePublicUrlError("Unsafe public address");
  }
  const pinned = candidates[0]!;
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      url,
      {
        method: "GET",
        agent: false,
        signal,
        maxHeaderSize: 16_384,
        headers: {
          accept: "application/json",
          "accept-encoding": "identity",
          "user-agent": "IsraelCounterpartyIntelligence/1.4",
        },
        lookup: (_host, options, callback) => {
          // Never perform a second DNS lookup, including the all:true Node connection path.
          if (options.all) callback(null, [pinned]);
          else callback(null, pinned.address, pinned.family);
        },
      },
      (response) => {
        const fail = (message: string) => {
          reject(new Error(message));
          response.destroy();
          req.destroy();
        };
        response.on("error", reject);
        if (
          !response.statusCode ||
          response.statusCode < 200 ||
          response.statusCode >= 300
        ) {
          fail("Public response status rejected"); // Redirects are never followed.
          return;
        }
        if (
          response.headers["content-encoding"] &&
          response.headers["content-encoding"] !== "identity"
        ) {
          fail("Compressed public response rejected");
          return;
        }
        if (Number(response.headers["content-length"]) > maxBytes) {
          fail("Public response exceeds the size limit");
          return;
        }
        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on("data", (chunk: Buffer) => {
          bytes += chunk.byteLength;
          if (bytes > maxBytes) {
            fail("Public response exceeds the size limit");
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          if (bytes > maxBytes) return;
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch {
            reject(new Error("Public response is not valid JSON"));
          }
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}
