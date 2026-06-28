/** @type {import('next').NextConfig} */
const nextConfig = {
  // Route handlers run on the Node.js runtime (livekit-server-sdk needs Node APIs).
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
