import { readFile } from "node:fs/promises";

export const INVOICE_PREVIEW_TOOL = "preview_israeli_invoice_payment_gate_free";
export const INVOICE_PAID_TOOL = "authorize_israeli_invoice_payment_paid";
export const INVOICE_MAX_AMOUNT = 250_000n;

export async function readInvoiceFile(path) {
  // A bounded, local JSON file; never evaluate invoice fields as shell commands.
  const file = await readFile(path);
  if (file.length > 65_536)
    throw new Error("Invoice JSON must not exceed 64 KiB");
  let value;
  try {
    value = JSON.parse(file.toString("utf8").replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("Invoice file must contain valid JSON");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invoice file must contain one JSON object");
  }
  return value;
}

export function enforceInvoicePreview(preview) {
  if (
    preview?.preview !== true ||
    !["HOLD", "PAY"].includes(preview?.decision?.action) ||
    !["REQUIRED", "NOT_REQUIRED"].includes(
      preview?.policy?.allocation_applicability,
    )
  ) {
    throw new Error(
      "Payment blocked: correct invoice errors and complete buyer answers in the free preview first",
    );
  }
}

export function acceptsCappedPayment(requirement, maxAmount) {
  return Boolean(
    requirement &&
    requirement.scheme === "exact" &&
    requirement.network === "eip155:8453" &&
    typeof requirement.asset === "string" &&
    requirement.asset.toLowerCase() ===
      "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" &&
    typeof requirement.payTo === "string" &&
    /^0x[0-9a-fA-F]{40}$/.test(requirement.payTo) &&
    typeof requirement.amount === "string" &&
    /^[1-9][0-9]{0,20}$/.test(requirement.amount) &&
    BigInt(requirement.amount) <= maxAmount,
  );
}
