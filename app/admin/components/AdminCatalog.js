"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./AdminCatalog.module.css";

const emptyCategory = { name: "", description: "", sortOrder: 0, active: true };
const emptyProduct = {
  categoryId: "",
  name: "",
  description: "",
  price: "",
  priceConfigured: true,
  unit: "un",
  imagePath: "",
  featured: false,
  active: true,
  stockControl: false,
  stockQuantity: 0,
  sortOrder: 0,
  pricingMode: "fixed",
  availableDelivery: true,
  availableInternal: true,
};

const brl = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const normalizeSearch = (value) => String(value || "").toLocaleLowerCase("pt-BR").trim();

export default function AdminCatalog() {
  const router = useRouter();
  const [catalog, setCatalog] = useState({ categories: [], products: [] });
  const [categoryForm, setCategoryForm] = useState(emptyCategory);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [file, setFile] = useState(null);
  const [gemasterFile, setGemasterFile] = useState(null);
  const [gemasterResult, setGemasterResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [catalogView, setCatalogView] = useState("internal");
  const [productSearch, setProductSearch] = useState("");

  const request = useCallback(async (url, options) => {
    const response = await fetch(url, options);
    const body = await response.json().catch(() => ({}));
    if (response.status === 401) {
      router.replace("/admin/login");
      router.refresh();
      throw new Error("Sessão expirada.");
    }
    if (!response.ok) throw new Error(body?.error?.message || "Não foi possível concluir a operação.");
    return body.data;
  }, [router]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setCatalog(await request("/api/admin/catalog"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const stats = useMemo(() => ({
    categories: catalog.categories.filter((item) => item.active).length,
    products: catalog.products.filter((item) => item.active).length,
    delivery: catalog.products.filter((item) => item.active && item.available_delivery).length,
    internal: catalog.products.filter((item) => item.active && item.available_internal).length,
    pending: catalog.products.filter((item) => item.active && !item.price_configured).length,
    gemaster: catalog.products.filter((item) => item.gemaster).length,
  }), [catalog]);

  const filteredProducts = useMemo(() => {
    const search = normalizeSearch(productSearch);
    return catalog.products.filter((item) => {
      const inView = catalogView === "delivery"
        ? item.available_delivery
        : catalogView === "pending"
          ? !item.price_configured
          : item.available_internal;
      if (!inView) return false;
      if (!search) return true;

      const haystack = [
        item.name,
        item.category?.name,
        item.gemaster?.code,
        item.gemaster?.reference,
      ].map(normalizeSearch).join(" ");
      return haystack.includes(search);
    });
  }, [catalog.products, catalogView, productSearch]);

  const visibleProducts = filteredProducts.slice(0, 150);

  function feedback(text) {
    setMessage(text);
    setError("");
    window.setTimeout(() => setMessage(""), 3000);
  }

  async function submitGemasterImport(event) {
    event.preventDefault();
    if (!gemasterFile) {
      setError("Selecione o CSV exportado do GeMaster.");
      return;
    }

    try {
      setImporting(true);
      setError("");
      setGemasterResult(null);
      const formData = new FormData();
      formData.append("file", gemasterFile);
      const result = await request("/api/admin/products/import-gemaster", { method: "POST", body: formData });
      setGemasterResult(result);
      setGemasterFile(null);
      feedback(`Importação concluída: ${result.processed} produtos processados.`);
      await load();
      setCatalogView(result.price_pending ? "pending" : "internal");
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  async function submitCategory(event) {
    event.preventDefault();
    try {
      setSaving(true);
      const url = editingCategory ? `/api/admin/categories/${editingCategory}` : "/api/admin/categories";
      await request(url, {
        method: editingCategory ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(categoryForm),
      });
      setCategoryForm(emptyCategory);
      setEditingCategory(null);
      feedback(editingCategory ? "Categoria atualizada." : "Categoria criada.");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitProduct(event) {
    event.preventDefault();
    try {
      setSaving(true);
      let imagePath = productForm.imagePath || null;
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        const uploaded = await request("/api/admin/uploads/products", { method: "POST", body: formData });
        imagePath = uploaded.path;
      }

      const payload = { ...productForm, categoryId: productForm.categoryId || null, imagePath };
      const url = editingProduct ? `/api/admin/products/${editingProduct}` : "/api/admin/products";
      await request(url, {
        method: editingProduct ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setProductForm(emptyProduct);
      setEditingProduct(null);
      setFile(null);
      feedback(editingProduct ? "Produto atualizado." : "Produto criado.");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function editCategory(item) {
    setEditingCategory(item.id);
    setCategoryForm({ name: item.name, description: item.description || "", sortOrder: item.sort_order, active: item.active });
    document.getElementById("category-form")?.scrollIntoView({ behavior: "smooth" });
  }

  function editProduct(item) {
    setEditingProduct(item.id);
    setFile(null);
    setProductForm({
      categoryId: item.category_id || "",
      name: item.name,
      description: item.description || "",
      price: item.price_configured ? item.price : "",
      priceConfigured: item.price_configured,
      unit: item.unit || "un",
      imagePath: item.image_path || "",
      featured: item.featured,
      active: item.active,
      stockControl: item.stock_control,
      stockQuantity: item.stock_quantity,
      sortOrder: item.sort_order,
      pricingMode: item.pricing_mode || "fixed",
      availableDelivery: item.available_delivery,
      availableInternal: item.available_internal,
    });
    document.getElementById("product-form")?.scrollIntoView({ behavior: "smooth" });
  }

  async function archive(kind, id, name) {
    if (!window.confirm(`Arquivar ${name}? Ele deixará de aparecer no cardápio.`)) return;
    try {
      await request(`/api/admin/${kind}/${id}`, { method: "DELETE" });
      feedback("Item arquivado.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div><span>OPERAÇÃO</span><h1>Cardápios</h1><p>Organize separadamente os produtos do delivery e das vendas internas.</p></div>
        <a href="/" target="_blank" rel="noreferrer">Ver site</a>
      </header>

      <section className={styles.stats}>
        <article><strong>{stats.products}</strong><span>Produtos ativos</span></article>
        <article><strong>{stats.gemaster}</strong><span>Vinculados ao GeMaster</span></article>
        <article><strong>{stats.pending}</strong><span>Preços pendentes</span></article>
      </section>

      {message && <div className={styles.success}>{message}</div>}
      {error && <div className={styles.error}>{error}</div>}

      <section className={`${styles.panel} ${styles.importPanel}`}>
        <div className={styles.panelHead}>
          <div><h2>Importar catálogo do GeMaster</h2><p>Importação idempotente pelo CódigoProduto. Referências são preservadas exatamente como vieram do GeMaster.</p></div>
        </div>
        <form className={styles.importForm} onSubmit={submitGemasterImport}>
          <label>CSV do GeMaster<input type="file" accept=".csv,text/csv,text/plain" onChange={(event) => setGemasterFile(event.target.files?.[0] || null)} /></label>
          <button disabled={importing || !gemasterFile}>{importing ? "Importando..." : "Importar produtos"}</button>
        </form>
        <p className={styles.importHint}>Produtos novos entram na venda interna e fora do delivery. Se o preço vier NULL ou 0, ficam como “Preço pendente” e não podem ser vendidos até a edição.</p>
        {gemasterResult && <div className={styles.importResult}>
          <span><strong>{gemasterResult.processed}</strong> processados</span>
          <span><strong>{gemasterResult.created}</strong> criados</span>
          <span><strong>{gemasterResult.matched_existing}</strong> vinculados a cadastros existentes</span>
          <span><strong>{gemasterResult.already_mapped}</strong> já mapeados</span>
          <span><strong>{gemasterResult.price_pending}</strong> com preço pendente</span>
        </div>}
      </section>

      <section className={styles.panel} id="category-form">
        <div className={styles.panelHead}><div><h2>Categorias</h2><p>Estruture as seções exibidas no cardápio.</p></div></div>
        <form className={styles.formGrid} onSubmit={submitCategory}>
          <label>Nome<input value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} required /></label>
          <label>Ordem<input type="number" value={categoryForm.sortOrder} onChange={(e) => setCategoryForm({ ...categoryForm, sortOrder: Number(e.target.value) })} /></label>
          <label className={styles.wide}>Descrição<input value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} /></label>
          <label className={styles.check}><input type="checkbox" checked={categoryForm.active} onChange={(e) => setCategoryForm({ ...categoryForm, active: e.target.checked })} /> Ativa</label>
          <div className={styles.actions}>
            {editingCategory && <button type="button" className={styles.secondary} onClick={() => { setEditingCategory(null); setCategoryForm(emptyCategory); }}>Cancelar</button>}
            <button disabled={saving}>{editingCategory ? "Salvar categoria" : "Adicionar categoria"}</button>
          </div>
        </form>

        <div className={styles.tableWrap}><table><thead><tr><th>Categoria</th><th>Status</th><th>Ordem</th><th></th></tr></thead><tbody>
          {catalog.categories.map((item) => <tr key={item.id}><td><strong>{item.name}</strong><small>{item.description || "Sem descrição"}</small></td><td><span className={item.active ? styles.on : styles.off}>{item.active ? "Ativa" : "Arquivada"}</span></td><td>{item.sort_order}</td><td className={styles.rowActions}><button onClick={() => editCategory(item)}>Editar</button>{item.active && <button onClick={() => archive("categories", item.id, item.name)}>Arquivar</button>}</td></tr>)}
        </tbody></table></div>
      </section>

      <section className={styles.panel} id="product-form">
        <div className={styles.panelHead}><div><h2>Produtos</h2><p>Preço, imagem, códigos GeMaster, disponibilidade e estoque ficam centralizados aqui.</p></div></div>
        {editingProduct && catalog.products.find((item) => item.id === editingProduct)?.gemaster && <div className={styles.gemasterIdentity}>
          <strong>Vínculo GeMaster preservado</strong>
          <span>Código: {catalog.products.find((item) => item.id === editingProduct)?.gemaster?.code}</span>
          <span>Referência: {catalog.products.find((item) => item.id === editingProduct)?.gemaster?.reference || "Não informada"}</span>
        </div>}
        <form className={styles.formGrid} onSubmit={submitProduct}>
          <label>Nome<input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} required /></label>
          <label>Categoria<select value={productForm.categoryId} onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}><option value="">Sem categoria</option>{catalog.categories.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Preço (R$)<input type="number" min="0" step="0.01" value={productForm.price} placeholder={productForm.priceConfigured ? "0,00" : "Preço pendente"} onChange={(e) => setProductForm({ ...productForm, price: e.target.value, priceConfigured: e.target.value !== "" })} required={productForm.priceConfigured} /></label>
          <label>Unidade<input value={productForm.unit} onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })} /></label>
          <label>Tipo de preço<select value={productForm.pricingMode} onChange={(e) => setProductForm({ ...productForm, pricingMode: e.target.value, ...(e.target.value === "variable" ? { availableDelivery: false, featured: false } : {}) })}><option value="fixed">Preço fixo</option><option value="variable">Informado após pesagem</option></select></label>
          <label className={styles.wide}>Descrição<textarea value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} rows="3" /></label>
          <label>Imagem<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
          <label>Ordem<input type="number" value={productForm.sortOrder} onChange={(e) => setProductForm({ ...productForm, sortOrder: Number(e.target.value) })} /></label>
          <label className={styles.check}><input type="checkbox" checked={productForm.active} onChange={(e) => setProductForm({ ...productForm, active: e.target.checked })} /> Disponível</label>
          <label className={styles.check}><input type="checkbox" checked={productForm.availableDelivery} disabled={productForm.pricingMode === "variable" || !productForm.priceConfigured} onChange={(e) => setProductForm({ ...productForm, availableDelivery: e.target.checked, ...(!e.target.checked ? { featured: false } : {}) })} /> Cardápio delivery</label>
          <label className={styles.check}><input type="checkbox" checked={productForm.availableInternal} onChange={(e) => setProductForm({ ...productForm, availableInternal: e.target.checked })} /> Venda interna</label>
          <label className={styles.check}><input type="checkbox" checked={productForm.featured} disabled={!productForm.availableDelivery} onChange={(e) => setProductForm({ ...productForm, featured: e.target.checked })} /> Destaque no site</label>
          <label className={styles.check}><input type="checkbox" checked={productForm.stockControl} onChange={(e) => setProductForm({ ...productForm, stockControl: e.target.checked })} /> Controlar estoque</label>
          {productForm.stockControl && <label>Estoque<input type="number" min="0" step="0.001" value={productForm.stockQuantity} onChange={(e) => setProductForm({ ...productForm, stockQuantity: Number(e.target.value) })} /></label>}
          {!productForm.priceConfigured && <div className={styles.priceWarning}>⚠ Este produto está com preço pendente. Informe o valor antes de utilizá-lo em vendas.</div>}
          <div className={styles.actions}>
            {editingProduct && <button type="button" className={styles.secondary} onClick={() => { setEditingProduct(null); setProductForm(emptyProduct); setFile(null); }}>Cancelar</button>}
            <button disabled={saving}>{editingProduct ? "Salvar produto" : "Adicionar produto"}</button>
          </div>
        </form>

        <div className={styles.catalogToolbar}>
          <div className={styles.catalogTabs} role="tablist" aria-label="Escolher cardápio">
            <button type="button" role="tab" aria-selected={catalogView === "internal"} onClick={() => setCatalogView("internal")}>Venda interna <span>{stats.internal}</span></button>
            <button type="button" role="tab" aria-selected={catalogView === "pending"} onClick={() => setCatalogView("pending")}>Preços pendentes <span>{stats.pending}</span></button>
            <button type="button" role="tab" aria-selected={catalogView === "delivery"} onClick={() => setCatalogView("delivery")}>Delivery <span>{stats.delivery}</span></button>
          </div>
          <input className={styles.productSearch} value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Buscar por nome, código ou referência GeMaster" />
        </div>

        {loading ? <p className={styles.loading}>Carregando catálogo...</p> : <div className={styles.products}>
          {visibleProducts.map((item) => <article key={item.id} className={!item.active ? styles.archived : ""}>
            <div className={styles.thumb}>{item.image_url ? <img src={item.image_url} alt="" /> : <span>Sem foto</span>}</div>
            <div className={styles.productInfo}>
              <small>{item.category?.name || "Sem categoria"}</small>
              <strong>{item.name}</strong>
              <span>{!item.price_configured ? "Preço pendente" : item.pricing_mode === "variable" ? `${brl(item.price)}/kg` : `${brl(item.price)} · ${item.unit}`}</span>
              {item.gemaster && <span className={styles.gemasterCode}>GeMaster: {item.gemaster.code}{item.gemaster.reference ? ` · Ref. ${item.gemaster.reference}` : ""}</span>}
              <div className={styles.channelBadges}>{!item.price_configured && <em className={styles.pendingBadge}>Preço pendente</em>}{item.available_delivery && <em>Delivery</em>}{item.available_internal && <em>Interno</em>}</div>
              {item.stock_control && <em>Estoque: {item.stock_quantity}</em>}
            </div>
            <div className={styles.rowActions}><button onClick={() => editProduct(item)}>Editar</button>{item.active && <button onClick={() => archive("products", item.id, item.name)}>Arquivar</button>}</div>
          </article>)}
          {filteredProducts.length > visibleProducts.length && <p className={styles.resultLimit}>Mostrando os primeiros {visibleProducts.length} de {filteredProducts.length} produtos. Use a busca para localizar o produto desejado.</p>}
          {filteredProducts.length === 0 && <p className={styles.emptyCatalog}>Nenhum produto encontrado neste filtro.</p>}
        </div>}
      </section>
    </div>
  );
}
