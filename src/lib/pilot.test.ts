import { beforeEach, describe, expect, it, vi } from "vitest";

const hex = (character: string) => character.repeat(64);
const farFuture = "2099-01-01T00:00:00.000Z";

describe("partner pilot metering and configuration", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("meters calls per partner, stops at the allowance, and does not charge failures", async () => {
    vi.stubEnv(
      "PILOT_KEYS",
      JSON.stringify([
        {
          partner_id: "alpha",
          token_sha256: hex("a"),
          expires_at: farFuture,
          call_limit: 2,
        },
        {
          partner_id: "beta",
          token_sha256: hex("b"),
          expires_at: farFuture,
          call_limit: 2,
        },
      ]),
    );
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { pilotPartners, runPilotOperation } = await import("@/lib/pilot");
    const [alpha, beta] = pilotPartners;
    if (!alpha || !beta) throw new Error("expected two configured partners");

    await expect(
      runPilotOperation(alpha, "verify", async () => ({ ok: 1 })),
    ).resolves.toMatchObject({
      ok: 1,
      pilot: { partner_id: "alpha", call_limit: 2 },
    });
    await expect(
      runPilotOperation(alpha, "invoice_gate", async () => {
        throw new Error("upstream boom");
      }),
    ).rejects.toThrow("upstream boom");
    await expect(
      runPilotOperation(alpha, "invoice_gate", async () => ({ ok: 2 })),
    ).resolves.toMatchObject({ ok: 2 });
    await expect(
      runPilotOperation(alpha, "payment_risk", async () => ({ ok: 3 })),
    ).rejects.toMatchObject({ status: 429, code: "PILOT_QUOTA_EXHAUSTED" });
    await expect(
      runPilotOperation(beta, "company_changes", async () => ({ ok: 4 })),
    ).resolves.toMatchObject({ pilot: { partner_id: "beta" } });

    const events = info.mock.calls
      .map(([line]) => JSON.parse(String(line)) as Record<string, unknown>)
      .filter((event) => event.event === "pilot_call");
    expect(
      events
        .filter((event) => event.status === "success")
        .map((event) => [event.partner_id, event.tool, event.local_sequence]),
    ).toEqual([
      ["alpha", "verify", 1],
      ["alpha", "invoice_gate", 2],
      ["beta", "company_changes", 1],
    ]);
    expect(events.find((event) => event.status === "failed")).toMatchObject({
      partner_id: "alpha",
      tool: "invoice_gate",
      local_sequence: 2,
      call_limit: 2,
    });
    info.mockRestore();
  });

  it("enforces the allowance on the durable total and releases the reservation", async () => {
    vi.stubEnv(
      "PILOT_KEYS",
      JSON.stringify([
        {
          partner_id: "gamma",
          token_sha256: hex("f"),
          expires_at: farFuture,
          call_limit: 100,
        },
      ]),
    );
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    const bodies: unknown[] = [];
    let periodTotal = 100;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Array<Array<unknown>>;
        bodies.push(body);
        const delta = Number(body[0]?.[3] ?? 0);
        periodTotal += delta;
        return new Response(
          JSON.stringify([
            { result: periodTotal },
            { result: 1 },
            { result: periodTotal },
            { result: 1 },
          ]),
          { status: 200 },
        );
      }),
    );
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { pilotPartners, runPilotOperation } = await import("@/lib/pilot");
    const [gamma] = pilotPartners;
    if (!gamma) throw new Error("expected a configured partner");

    // Durable total is already at the allowance: the 101st call is rejected
    // and its reservation is released, so the in-process cap does not matter.
    const operation = vi.fn(async () => ({ ok: true }));
    await expect(
      runPilotOperation(gamma, "invoice_gate", operation),
    ).rejects.toMatchObject({ status: 429, code: "PILOT_QUOTA_EXHAUSTED" });
    expect(operation).not.toHaveBeenCalled();
    expect(bodies).toHaveLength(2);
    expect((bodies[1] as Array<Array<unknown>>)[0]).toEqual([
      "HINCRBY",
      "ici:pilot:usage:gamma",
      "total",
      -1,
    ]);
    expect(periodTotal).toBe(100);

    // Below the allowance the call succeeds and reports the durable totals.
    periodTotal = 10;
    await expect(
      runPilotOperation(gamma, "verify", async () => ({ ok: 1 })),
    ).resolves.toMatchObject({
      ok: 1,
      pilot: {
        partner_id: "gamma",
        usage: { durable: true, period_total: 11 },
      },
    });
  });

  it("falls back to the single-partner PILOT_* variables when PILOT_KEYS is unset", async () => {
    vi.stubEnv("PILOT_KEYS", "");
    vi.stubEnv("PILOT_PARTNER_ID", "legacy-partner");
    vi.stubEnv("PILOT_TOKEN_SHA256", hex("c"));
    vi.stubEnv("PILOT_EXPIRES_AT", farFuture);
    vi.stubEnv("PILOT_VERIFICATION_LIMIT", "7");
    const { pilotPartners } = await import("@/lib/pilot");
    expect(pilotPartners).toEqual([
      {
        partner_id: "legacy-partner",
        token_sha256: hex("c"),
        expires_at: farFuture,
        call_limit: 7,
      },
    ]);
  });

  it("refuses malformed or duplicate PILOT_KEYS at startup", async () => {
    vi.stubEnv("PILOT_KEYS", "{not json");
    await expect(import("@/lib/config")).rejects.toThrow(/PILOT_KEYS/);

    vi.resetModules();
    vi.stubEnv(
      "PILOT_KEYS",
      JSON.stringify([
        { partner_id: "dup", token_sha256: hex("d"), expires_at: farFuture },
        { partner_id: "dup", token_sha256: hex("e"), expires_at: farFuture },
      ]),
    );
    await expect(import("@/lib/config")).rejects.toThrow(/unique/);
  });
});
