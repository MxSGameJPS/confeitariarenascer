export async function GET() {
  const manifest = {
    id: "/operacao/pesagem",
    name: "Renascer Pesagem",
    short_name: "Pesagem",
    description: "Estação de pesagem da Renascer Padaria e Confeitaria.",
    start_url: "/operacao/pesagem",
    scope: "/operacao/pesagem",
    display: "standalone",
    orientation: "any",
    background_color: "#f6efe5",
    theme_color: "#3a271a",
    lang: "pt-BR",
    icons: [
      {
        src: "/pwa/pesagem-icon.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/pwa/pesagem-icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any maskable",
      },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
