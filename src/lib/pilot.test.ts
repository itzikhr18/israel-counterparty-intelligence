import { beforeEach, describe, expect, it, vi } from "vitest";

const hex = (character: string) => character.repeat(64);
const farFuture = "2099-01-01T00:00:00.000Z";

describe("partner pilot metering and configuration", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
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
