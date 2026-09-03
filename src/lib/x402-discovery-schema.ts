export function x402DiscoverySchema<T>(schema: T): T {
  if (Array.isArray(schema)) {
    return schema.map((value) => x402DiscoverySchema(value)) as T;
  }

  if (!schema || typeof schema !== "object") return schema;

  return Object.fromEntries(
    Object.entries(schema).flatMap(([key, value]) =>
      key === "format" ? [] : [[key, x402DiscoverySchema(value)]],
    ),
  ) as T;
}
