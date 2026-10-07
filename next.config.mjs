/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    // Coinbase CDP SDK optionally pulls x402 payment helpers; wagmi's connectors
    // barrel reaches it transitively via baseAccount. We don't use baseAccount.
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@x402/core/client": false,
      "@x402/svm/exact/client": false,
      "@x402/evm": false,
    };
    return config;
  },
};

export default nextConfig;
