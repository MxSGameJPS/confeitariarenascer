"use client";

import { useEffect } from "react";

const REVEAL_SELECTOR =
  ".reveal, .reveal-left, .reveal-right, .reveal-scale";

/**
 * Ativa animações de scroll em elementos existentes e também nos que entram
 * no DOM depois de carregamentos assíncronos (ex.: cardápio e destaques).
 * Também controla o parallax leve de elementos [data-parallax]
 * e a barra de progresso de scroll [data-progress].
 */
export default function ScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );

    const observeRevealElements = (root = document) => {
      if (root instanceof Element && root.matches(REVEAL_SELECTOR)) {
        observer.observe(root);
      }

      root
        .querySelectorAll?.(REVEAL_SELECTOR)
        .forEach((element) => observer.observe(element));
    };

    // Elementos que já existem no mount.
    observeRevealElements(document);

    // Elementos adicionados depois, como produtos carregados via fetch.
    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            observeRevealElements(node);
          }
        });
      });
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Parallax + barra de progresso
    const parallaxEls = document.querySelectorAll("[data-parallax]");
    const progressBar = document.querySelector("[data-progress]");

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrollY = window.scrollY;

        parallaxEls.forEach((el) => {
          const speed = parseFloat(el.getAttribute("data-parallax")) || 0.2;
          el.style.transform = `translate3d(0, ${scrollY * speed}px, 0)`;
        });

        if (progressBar) {
          const docHeight =
            document.documentElement.scrollHeight - window.innerHeight;
          const pct = docHeight > 0 ? (scrollY / docHeight) * 100 : 0;
          progressBar.style.width = `${pct}%`;
        }

        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return null;
}
