"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function StaffLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/staff/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(body?.error?.message || "Não foi possível entrar.");
        return;
      }

      router.replace("/operacao");
      router.refresh();
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.brand}>
          <span>R</span>
          <div>
            <strong>Renascer</strong>
            <small>Operação</small>
          </div>
        </div>

        <div className={styles.heading}>
          <p>ACESSO DA EQUIPE</p>
          <h1>Iniciar turno</h1>
          <span>Entre com o usuário e a senha cadastrados pelo responsável.</span>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label>
            Usuário
            <input
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
              required
            />
          </label>

          <label>
            Senha
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar na operação"}
          </button>
        </form>

        <a href="/" className={styles.back}>Voltar para o site</a>
      </section>
    </main>
  );
}
