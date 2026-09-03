export const metadata = {
  title: "Renascer Pesagem",
  description: "Estação de pesagem da Renascer Padaria e Confeitaria.",
  manifest: "/api/pwa/pesagem/manifest",
  icons: {
    icon: "/pwa/pesagem-icon.svg",
  },
  appleWebApp: {
    capable: true,
    title: "Renascer Pesagem",
    statusBarStyle: "default",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#3a271a",
};

export default function WeighingLayout({ children }) {
  return children;
}
