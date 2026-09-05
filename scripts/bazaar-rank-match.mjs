export function matchesServiceOrigin(tool, serviceOrigin) {
  const resourceUrl = tool?._meta?.["x402/payment-required"]?.resource?.url;
  if (typeof resourceUrl !== "string") return false;
  try {
    const resource = new URL(resourceUrl);
    return (
      resource.origin === new URL(serviceOrigin).origin &&
      resource.username === "" &&
      resource.password === ""
    );
  } catch {
    return false;
  }
}
