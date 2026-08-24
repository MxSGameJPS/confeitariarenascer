import { Playfair_Display, Poppins } from "next/font/google";
import "./globals.css";
import { CartProvider } from "./components/CartContext";
import CartDrawer from "./components/CartDrawer";
import CheckoutModal from "./components/CheckoutModal";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata = {
  title: "Padaria e Confeitaria Renascer | Um sabor que conquista",
  description:
    "Delivery de doces, salgados, bolos e tortas artesanais em Ivoti/RS. Peça já pelo WhatsApp e receba um sabor que conquista.",
  keywords: [
    "padaria Ivoti",
    "confeitaria Ivoti",
    "delivery de bolos",
    "doces artesanais",
    "salgados Ivoti",
    "Padaria Renascer",
  ],
  openGraph: {
    title: "Padaria e Confeitaria Renascer",
    description: "Um sabor que conquista — delivery em Ivoti/RS.",
    locale: "pt_BR",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${playfair.variable} ${poppins.variable}`}>
      <body>
        <CartProvider>
          {children}
          <CartDrawer />
          <CheckoutModal />
        </CartProvider>
      </body>
    </html>
  );
}

