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
      // `/qa` was the legacy quality URL; `/qa-qc` is the canonical quality route
      // (UX-R1A C2 + Option A). Same reversible pattern as `/statistici`: the page
      // no longer exists, the URL keeps working.
      { source: '/qa', destination: '/qa-qc', permanent: false },
    ];
  },
};

module.exports = nextConfig;
