import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { main } from "../bin/israel-company-verify-buyer.mjs";

const fixture = fileURLToPath(
  new URL("../../public/examples/invoice-request.json", import.meta.url),
);
const preview = {
  preview: true,
  decision: { action: "HOLD" },
  policy: { allocation_applicability: "NOT_REQUIRED" },
};

test("invoice CLI is free by default and passes the original invoice unchanged", async () => {
  const seen = [];
  await main(["--invoice-file", fixture], {
    free: async (tool, args) => {
      seen.push({ tool, args });
      return { structuredContent: preview };
    },
    paid: async () => {
      assert.fail("must not pay without --pay");
    },
  });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].tool, "preview_israeli_invoice_payment_gate_free");
  assert.equal(seen[0].args.invoice_number, "SAMPLE-NOT-A-REAL-INVOICE");
});

test("explicit invoice purchase checks free preview and supplier before exactly one mocked paid call", async () => {
  const seen = [];
  await main(["--invoice-file", fixture, "--pay"], {
    free: async (tool) => {
      seen.push(tool);
      return {
        structuredContent: tool.startsWith("preview_israeli_invoice")
          ? preview
          : { resolution_status: "RESOLVED" },
      };
    },
    paid: async (options) => {
      seen.push("mock_paid");
      assert.equal(options.invoiceQuery.total_amount, 1180);
      return {
        structuredContent: { decision: { action: "HOLD" } },
        paymentMade: true,
      };
    },
  });
  assert.deepEqual(seen, [
    "preview_israeli_invoice_payment_gate_free",
    "preview_israeli_company_free",
    "mock_paid",
  ]);
});

test("blocked preview and unresolved supplier prevent even invoking payment", async () => {
  for (const blocked of [true, false]) {
    await assert.rejects(
      main(["--invoice-file", fixture, "--pay"], {
        free: async (tool) => ({
          structuredContent: tool.startsWith("preview_israeli_invoice")
            ? blocked
              ? { ...preview, decision: { action: "BLOCK" } }
              : preview
            : { resolution_status: "NOT_FOUND" },
        }),
        paid: async () => {
          assert.fail("must not pay a blocked/unresolved invoice");
        },
      }),
      /Payment blocked/,
    );
  }
});

test("incompatible invoice modes fail before network access", async () => {
  await assert.rejects(
    main(["--invoice-file", fixture, "--sample"]),
    /cannot be combined/,
  );
});
