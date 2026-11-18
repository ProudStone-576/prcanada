import type { NextConfig } from "next";

// Pages get a per-request nonce CSP from proxy.ts. API responses (JSON and file downloads) get this one.
const apiCsp = "default-src 'none'; frame-ancestors 'none'; sandbox";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // A self-contained server in .next/standalone for Docker or any Node host.
  output: "standalone",
  // pdf.js loads its worker module at runtime; bundling breaks that import.
  serverExternalPackages: ["pdfjs-dist"],
  // pdf.js imports its worker at runtime, which file tracing can't see; ship it with the upload route.
  outputFileTracingIncludes: {
    "/api/documents": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
  },
  async headers() {
    return [
      { source: "/api/:path*", headers: [{ key: "Content-Security-Policy", value: apiCsp }] },
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
