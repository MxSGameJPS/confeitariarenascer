export default function manifest() {
  return {
    name: "Padaria Renascer",
    short_name: "Renascer",
    description: "Delivery, comandas e operação da Padaria Renascer.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6efe5",
    theme_color: "#301d13",
    lang: "pt-BR",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
