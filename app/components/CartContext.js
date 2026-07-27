"use client";

import { createContext, useContext, useMemo, useState, useCallback } from "react";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]); // { id, nome, preco, emoji, img, qtd }
  const [open, setOpen] = useState(false); // drawer do carrinho
  const [checkout, setCheckout] = useState(false); // modal finalizar pedido

  const addItem = useCallback((produto) => {
    setItems((prev) => {
      const found = prev.find((p) => p.id === produto.id);
      if (found) {
        return prev.map((p) =>
          p.id === produto.id ? { ...p, qtd: p.qtd + 1 } : p
        );
      }
      return [...prev, { ...produto, qtd: 1 }];
    });
    setOpen(true);
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const changeQtd = useCallback((id, delta) => {
    setItems((prev) =>
      prev
        .map((p) => (p.id === id ? { ...p, qtd: p.qtd + delta } : p))
        .filter((p) => p.qtd > 0)
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const { total, count } = useMemo(() => {
    let total = 0;
    let count = 0;
    for (const p of items) {
      total += p.preco * p.qtd;
      count += p.qtd;
    }
    return { total, count };
  }, [items]);

  const value = {
    items,
    total,
    count,
    open,
    checkout,
    setOpen,
    setCheckout,
    addItem,
    removeItem,
    changeQtd,
    clear,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart deve ser usado dentro de CartProvider");
  return ctx;
}