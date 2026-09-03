import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/v1/*": [
      "./node_modules/@x402/extensions/**/*",
      "./node_modules/@x402/core/**/*",
      "./node_modules/@signinwithethereum/**/*",
      "./node_modules/@noble/**/*",
      "./node_modules/@scure/**/*",
      "./node_modules/ajv/**/*",
      "./node_modules/fast-deep-equal/**/*",
      "./node_modules/fast-uri/**/*",
      "./node_modules/json-schema-traverse/**/*",
      "./node_modules/require-from-string/**/*",
      "./node_modules/jose/**/*",
      "./node_modules/tweetnacl/**/*",
      "./node_modules/viem/**/*",
      "./node_modules/abitype/**/*",
      "./node_modules/ox/**/*",
      "./node_modules/zod/**/*",
    ],
  },
};

export default nextConfig;
