import {
  paidRouteConfig,
  paymentEnvironments,
  type PaidRouteName,
  type PaymentEnvironmentName,
} from "@/lib/config";

export function priceToAtomicUsdc(price: string): string {
  const value = price.slice(1);
  const [whole, fraction = ""] = value.split(".");
  return `${whole}${fraction.padEnd(6, "0")}`.replace(/^0+(?=\d)/, "");
}

export function usdcEip712Domain(environmentName: PaymentEnvironmentName) {
  return {
    name: environmentName === "mainnet" ? "USD Coin" : "USDC",
    version: "2",
  };
}

export function paymentOptionFor(routeName: PaidRouteName) {
  const route = paidRouteConfig[routeName];
  const environment = paymentEnvironments[route.environment];
  return {
    scheme: "exact",
    price: {
      amount: priceToAtomicUsdc(route.price),
      asset: environment.asset,
      extra: usdcEip712Domain(route.environment),
    },
    network: environment.network,
    payTo: environment.payTo,
  };
}
