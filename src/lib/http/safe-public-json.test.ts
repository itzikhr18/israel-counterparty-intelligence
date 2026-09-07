import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import type { IncomingMessage } from "node:http";
import type { RequestOptions } from "node:https";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchPublicJson,
  isPublicAddress,
  UnsafePublicUrlError,
} from "@/lib/http/safe-public-json";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));
vi.mock("node:https", () => ({ request: vi.fn() }));
const dnsMock = vi.mocked(lookup) as ReturnType<typeof vi.fn>;

function transport(
  status = 200,
  chunks = [Buffer.from('{"ok":true}')],
  headers: Record<string, string> = {},
) {
  let options: RequestOptions;
  const response = Object.assign(new PassThrough(), {
    statusCode: status,
    headers,
  });
  const req = Object.assign(new EventEmitter(), {
    end: vi.fn(),
    destroy: vi.fn(),
  });
  vi.mocked(request).mockImplementation((...args: unknown[]) => {
    options = args[1] as RequestOptions;
    req.end.mockImplementation(() =>
      queueMicrotask(() => {
        (args[2] as (response: IncomingMessage) => void)(
          response as unknown as IncomingMessage,
        );
        for (const chunk of chunks) {
          if (!response.destroyed) response.write(chunk);
        }
        if (!response.destroyed) response.end();
      }),
    );
    return req as unknown as ReturnType<typeof request>;
  });
  return { response, req, options: () => options };
}

describe("pinned public HTTPS JSON transport", () => {
  afterEach(() => vi.resetAllMocks());
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.2",
    "100.64.0.1",
    "198.18.0.1",
    "192.0.2.1",
    "224.0.0.1",
    "::1",
    "::ffff:172.16.0.1",
    "::ffff:ac10:1",
    "fc00::1",
    "fe80::1",
    "2002:a00:1::",
    "2001:db8::1",
    "not-an-ip",
  ])("rejects private/special address %s", (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });
  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])(
    "accepts public address %s",
    (address) => {
      expect(isPublicAddress(address)).toBe(true);
    },
  );
  it.each([
    "http://example.test/",
    "https://user:pass@example.test/",
    "https://example.test:444/",
    "https://localhost/",
    "https://[::1]/",
  ])("rejects unsafe URL %s before connecting", async (url) => {
    await expect(fetchPublicJson(new URL(url))).rejects.toBeInstanceOf(
      UnsafePublicUrlError,
    );
    expect(request).not.toHaveBeenCalled();
  });
  it("rejects mixed public/private DNS answers before connecting", async () => {
    dnsMock.mockResolvedValue([
      { address: "1.1.1.1", family: 4 },
      { address: "10.0.0.1", family: 4 },
    ]);
    await expect(
      fetchPublicJson(new URL("https://merchant.test/")),
    ).rejects.toBeInstanceOf(UnsafePublicUrlError);
    expect(request).not.toHaveBeenCalled();
  });
  it("pins vetted DNS answers to the socket and retains the original TLS hostname", async () => {
    dnsMock
      .mockResolvedValueOnce([{ address: "1.1.1.1", family: 4 }])
      .mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);
    const mock = transport();
    expect(
      await fetchPublicJson(new URL("https://merchant.test/manifest")),
    ).toEqual({ ok: true });
    expect(lookup).toHaveBeenCalledOnce();
    expect(vi.mocked(request).mock.calls[0]![0]).toEqual(
      new URL("https://merchant.test/manifest"),
    );
    expect(mock.options()).toMatchObject({ agent: false });
    expect(mock.options().rejectUnauthorized).not.toBe(false);
    const callback = vi.fn();
    mock.options().lookup!("merchant.test", {}, callback);
    expect(callback).toHaveBeenCalledWith(null, "1.1.1.1", 4);
    const allCallback = vi.fn();
    mock.options().lookup!("merchant.test", { all: true }, allCallback);
    expect(allCallback).toHaveBeenCalledWith(null, [
      { address: "1.1.1.1", family: 4 },
    ]);
    expect(lookup).toHaveBeenCalledOnce();
  });
  it("does not follow a redirect to internal metadata", async () => {
    const mock = transport(302, [], { location: "https://169.254.169.254/" });
    await expect(fetchPublicJson(new URL("https://1.1.1.1/"))).rejects.toThrow(
      "status rejected",
    );
    expect(request).toHaveBeenCalledOnce();
    expect(mock.req.destroy).toHaveBeenCalled();
  });
  it("stops chunked bytes before buffering an oversized manifest with a lying length", async () => {
    const mock = transport(200, [Buffer.alloc(40_000), Buffer.alloc(40_000)], {
      "content-length": "1",
    });
    await expect(fetchPublicJson(new URL("https://1.1.1.1/"))).rejects.toThrow(
      "size limit",
    );
    expect(mock.response.destroyed).toBe(true);
    expect(mock.req.destroy).toHaveBeenCalled();
  });
  it("rejects compressed input and invalid JSON", async () => {
    transport(200, [], { "content-encoding": "gzip" });
    await expect(fetchPublicJson(new URL("https://1.1.1.1/"))).rejects.toThrow(
      "Compressed",
    );
    transport(200, [Buffer.from("{")]);
    await expect(fetchPublicJson(new URL("https://1.1.1.1/"))).rejects.toThrow(
      "valid JSON",
    );
  });
});
