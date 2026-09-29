/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@solar/shared'],
  reactStrictMode: true,
  async redirects() {
    return [
      // `/statistici` was merged into the canonical Control Tower route
      // (UX-R1A C2): the page no longer exists, the URL keeps working.
      // `permanent: false` keeps the redirect reversible while the IA settles.
      { source: '/statistici', destination: '/control-tower', permanent: false },
    ];
  },
};

module.exports = nextConfig;
