"use client";

import { useEffect } from "react";

/**
 * Ativa animações de scroll: adiciona a classe "is-visible"
 * em qualquer elemento com a classe .reveal / .reveal-left /
 * .reveal-right / .reveal-scale quando ele entra na viewport.
 * Também controla o parallax leve de elementos [data-parallax]
 * e a barra de progresso de scroll [data-progress].
 */
export default function ScrollReveal() {
  useEffect(() => {
    const revealEls = document.querySelectorAll(
      ".reveal, .reveal-left, .reveal-right, .reveal-scale"
    );

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

    revealEls.forEach((el) => observer.observe(el));

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
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return null;
}