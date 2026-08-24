import Header from "./components/Header";
import ScrollReveal from "./components/ScrollReveal";
import Menu from "./components/Menu";
import { Icon } from "./components/Icons";
import { destaques, HERO_IMG } from "./data/produtos";
import styles from "./page.module.css";

const WHATSAPP =
  "https://wa.me/5551000000000?text=Ol%C3%A1!%20Gostaria%20de%20fazer%20um%20pedido%20na%20Padaria%20Renascer.";
const INSTAGRAM = "https://www.instagram.com/padaria_renascerivoti/";
const MAPS =
  "https://www.google.com/maps/place/Padaria+Renascer/@-29.6079871,-51.1785649,17z";

const destIcons = { "d-morango": "Strawberry", "d-bolo": "Cake", "d-paoqueijo": "Bread" };

const passos = [
  {
    n: "01",
    titulo: "Escolha seus favoritos",
    texto: "Navegue pelo cardápio e adicione os produtos ao carrinho.",
  },
  {
    n: "02",
    titulo: "Finalize o pedido",
    texto: "Informe entrega ou retirada, seus dados e a forma de pagamento.",
  },
  {
    n: "03",
    titulo: "Receba em casa",
    texto: "Entregamos em Ivoti e região fresquinho, direto na sua porta.",
  },
];

export default function Home() {
  return (
    <>
      <ScrollReveal />
      <div className={styles.progress} data-progress />
      <Header />

      <main id="topo">
        {/* ---------------- HERO ---------------- */}
        <section className={styles.hero}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={HERO_IMG} alt="" className={styles.heroBg} data-parallax="0.12" />
          <div className={styles.heroOverlay} />
          <div className={styles.heroContent}>
          
            <h1 className={styles.heroTitle}>
              Um sabor que <span>conquista</span>
            </h1>
            <p className={styles.heroText}>
              Doces, salgados, bolos e pães artesanais feitos com carinho todos
              os dias. Agora com delivery direto na sua casa.
            </p>
            <div className={styles.heroActions}>
              <a className={styles.btnPrimary} href="#cardapio">
                <Icon.Cart width={18} height={18} /> Fazer meu pedido
              </a>
              <a className={styles.btnGhost} href="#historia">
                Conheça a história
              </a>
            </div>
          </div>
          <div className={styles.scrollHint}>
            <span />
            role para descobrir
          </div>
        </section>

        {/* ---------------- HISTÓRIA ---------------- */}
        <section id="historia" className={styles.historia}>
          <div className={styles.historiaGrid}>
            <div className={`${styles.historiaText} reveal-left`}>
              <span className={styles.sectionTag}>Nossa história</span>
              <h2>Mais que uma padaria, um pedacinho de Ivoti</h2>
              <p>
                A Padaria e Confeitaria Renascer nasceu do sonho de transformar
                ingredientes simples em momentos especiais. Cada receita carrega
                tradição, dedicação e aquele toque caseiro que faz a diferença.
              </p>
              <p>
                Ao longo dos anos, nos tornamos ponto de encontro da comunidade:
                do café da manhã ao bolo de aniversário, estamos presentes nos
                momentos que importam. É um sabor que conquista — e que faz você
                voltar sempre.
              </p>
              <div className={styles.stats}>
                <div>
                  <strong>+1.400</strong>
                  <span>seguidores</span>
                </div>
                <div>
                  <strong>+300</strong>
                  <span>receitas compartilhadas</span>
                </div>
                <div>
                  <strong>100%</strong>
                  <span>feito com carinho</span>
                </div>
              </div>
            </div>
            <div className={`${styles.historiaMedia} reveal-right`}>
              <div className={styles.mediaCard}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=70"
                  alt="Pães artesanais assados na hora"
                />
                <div className={styles.mediaBadge}>
                  <Icon.Chef width={22} height={22} />
                  <span>Feito à mão, do jeitinho de casa</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- FAIXA ---------------- */}
        <section className={styles.faixa}>
          <div className={styles.faixaTrack}>
            {Array.from({ length: 2 }).map((_, i) => (
              <span key={i}>
                Bolos · Tortas · Donuts · Pão de Queijo · Morango do Amor ·
                Brigadeiros · Salgados · Pães ·
              </span>
            ))}
          </div>
        </section>

        {/* ---------------- CARDÁPIO ---------------- */}
        <section id="cardapio" className={styles.cardapio}>
          <div className={`${styles.sectionHead} reveal`}>
            <span className={styles.sectionTag}>Nosso cardápio</span>
            <h2>Escolha, adicione ao carrinho e peça</h2>
            <p>
              Uma seleção do que preparamos com mais carinho. Monte seu pedido e
              finalize em poucos cliques.
            </p>
          </div>

          <Menu />
        </section>

        {/* ---------------- DESTAQUES ---------------- */}
        <section id="destaques" className={styles.destaques}>
          <div className={`${styles.sectionHead} reveal`}>
            <span className={styles.sectionTagLight}>Os queridinhos</span>
            <h2>Os favoritos da casa</h2>
          </div>
          <div className={styles.destGrid}>
            {destaques.map((d, i) => {
              const DIcon = Icon[destIcons[d.id]] || Icon.Cake;
              return (
                <article
                  key={d.id}
                  className={`${styles.destCard} reveal`}
                  style={{ transitionDelay: `${i * 0.1}s` }}
                >
                  <div className={styles.destImg}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={d.img} alt={d.titulo} loading="lazy" />
                    <span className={styles.destIcon}>
                      <DIcon width={22} height={22} />
                    </span>
                  </div>
                  <div className={styles.destBody}>
                    <h3>{d.titulo}</h3>
                    <p>{d.texto}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* ---------------- COMO PEDIR ---------------- */}
        <section className={styles.passos}>
          <div className={`${styles.sectionHead} reveal`}>
            <span className={styles.sectionTag}>Delivery fácil</span>
            <h2>Como fazer seu pedido</h2>
          </div>
          <div className={styles.passosGrid}>
            {passos.map((p, i) => (
              <div
                key={p.n}
                className={`${styles.passo} reveal`}
                style={{ transitionDelay: `${i * 0.12}s` }}
              >
                <span className={styles.passoNum}>{p.n}</span>
                <h3>{p.titulo}</h3>
                <p>{p.texto}</p>
              </div>
            ))}
          </div>
          <div className={`${styles.passosCta} reveal-scale`}>
            <a className={styles.btnPrimary} href="#cardapio">
              <Icon.Cart width={18} height={18} /> Ver cardápio
            </a>
          </div>
        </section>

        {/* ---------------- LOCALIZAÇÃO ---------------- */}
        <section id="localizacao" className={styles.local}>
          <div className={styles.localGrid}>
            <div className={`${styles.localInfo} reveal-left`}>
              <span className={styles.sectionTag}>Onde estamos</span>
              <h2>Venha nos visitar em Ivoti</h2>
              <ul className={styles.localList}>
                <li>
                  <span className={styles.localIcon}>
                    <Icon.Pin width={20} height={20} />
                  </span>
                  <div>
                    <strong>Endereço</strong>
                    Ivoti / RS
                  </div>
                </li>
                <li>
                  <span className={styles.localIcon}>
                    <Icon.Clock width={20} height={20} />
                  </span>
                  <div>
                    <strong>Horário</strong>
                    Consulte nossos horários pelo Instagram ou WhatsApp
                  </div>
                </li>
                <li>
                  <span className={styles.localIcon}>
                    <Icon.Bike width={20} height={20} />
                  </span>
                  <div>
                    <strong>Delivery</strong>
                    Entregamos em Ivoti e região
                  </div>
                </li>
              </ul>
              <div className={styles.localActions}>
                <a
                  className={styles.btnPrimary}
                  href={MAPS}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon.Pin width={18} height={18} /> Ver no mapa
                </a>
                <a
                  className={styles.btnGhostDark}
                  href={INSTAGRAM}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Seguir no Instagram
                </a>
              </div>
            </div>
            <div className={`${styles.localMapWrap} reveal-right`}>
              <iframe
                title="Localização Padaria Renascer"
                src="https://www.google.com/maps?q=Padaria+Renascer+Ivoti+RS&output=embed"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className={styles.map}
              />
            </div>
          </div>
        </section>

        {/* ---------------- CTA FINAL ---------------- */}
        <section className={styles.finalCta}>
          <div className={`${styles.finalInner} reveal-scale`}>
            <h2>
              Deu vontade? <span>A gente entrega.</span>
            </h2>
            <p>Um sabor que conquista, agora a um clique de distância.</p>
            <a className={styles.btnPrimaryLg} href="#cardapio">
              <Icon.Cart width={20} height={20} /> Montar meu pedido
            </a>
          </div>
        </section>
      </main>

      {/* ---------------- FOOTER ---------------- */}
      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <span className={styles.footerMark}>
            <Icon.Bread width={22} height={22} />
          </span>
          <div>
            <strong>Padaria & Confeitaria Renascer</strong>
            <em>Um sabor que conquista · Ivoti / RS</em>
          </div>
        </div>
        <nav className={styles.footerNav}>
          <a href="#historia">Nossa História</a>
          <a href="#cardapio">Cardápio</a>
          <a href="#localizacao">Localização</a>
          <a href={INSTAGRAM} target="_blank" rel="noopener noreferrer">
            Instagram
          </a>
        </nav>
        <p className={styles.footerNote}>
          Padaria & Confeitaria Renascer · Ivoti / RS · {new Date().getFullYear()}
        </p>
      </footer>

      {/* Botão flutuante WhatsApp */}
      <a
        className={styles.whatsFloat}
        href={WHATSAPP}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Pedir pelo WhatsApp"
      >
        <Icon.Whatsapp width={30} height={30} />
      </a>
    </>
  );
}

