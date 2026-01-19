/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable standalone output for Docker
  output: 'standalone',
  // Allow API calls to InfluxDB (if needed for CORS)
  async rewrites() {
    return [
      {
        source: '/api/influxdb/:path*',
        destination: 'http://localhost:8086/:path*',
      },
    ];
  },
  webpack: (config, { isServer }) => {
    // Provide process polyfill for browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        process: require.resolve('process/browser'),
      };
    }
    return config;
  },
}

module.exports = nextConfig

