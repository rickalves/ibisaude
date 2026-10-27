import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Site 100% estático: `next build` gera a pasta `out/`, que pode ir para qualquer hospedagem.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // cacheComponents (Partial Prerendering) não funciona com output: "export"; aqui tudo é gerado no build.
};

export default nextConfig;
