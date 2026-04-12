
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.railway.app",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "**.cloudinary.com",
      },
      {
        protocol: "http",
        hostname: "localhost",
      },
    ],
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_APP_NAME: "QuizClass",
    NEXT_PUBLIC_APP_CREDIT: "by Ikbal x RPL",
  },
};

module.exports = nextConfig;
