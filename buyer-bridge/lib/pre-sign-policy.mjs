export class AgentPaymentTrustError extends Error {
  constructor(action, reasonCodes = []) {
    super(
      `Payment signing blocked by ${action}: ${reasonCodes.join(", ") || "no reason supplied"}`,
    );
    this.name = "AgentPaymentTrustError";
    this.action = action;
    this.reasonCodes = reasonCodes;
  }
}

export function enforceAgentPaymentTrust(result) {
  const action = result?.decision?.action;
  const automationSafe = result?.decision?.automation_safe;
  if (action !== "ALLOW" || automationSafe !== true) {
    throw new AgentPaymentTrustError(
      action ?? "UNKNOWN",
      result?.decision?.reason_codes ?? [],
    );
  }
  return result;
}
