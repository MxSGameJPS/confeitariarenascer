import { requireStaffSession } from "@/src/shared/auth/staff-session";
import { ROLES } from "@/src/config/permissions";
import styles from "./page.module.css";

export default async function OperationHomePage() {
  const session = await requireStaffSession();
  const isManager = session.role === ROLES.GERENTE;

  return (
    <div className={styles.page}>
      <header>
        <span>OPERAÇÃO DO DIA</span>
        <h1>Olá, {session.fullName}</h1>
        <p>{isManager ? "Acompanhe o caixa e gerencie a equipe do turno." : "Delivery, comandas e vendas rápidas estão centralizados aqui."}</p>
      </header>

      <section className={styles.cards}>
        {!isManager && <article><small>DELIVERY</small><strong>Pedidos</strong><p>Aceite e acompanhe os pedidos recebidos pelo site.</p><a href="/operacao/delivery">Abrir delivery</a></article>}
        {!isManager && <article><small>MESAS</small><strong>Comandas</strong><p>Abra, receba e feche as comandas internas.</p><a href="/operacao/comandas">Abrir comandas</a></article>}
        <article><small>CAIXA</small><strong>Venda avulsa</strong><p>Registre venda presencial, pagamento e responsável.</p><a href="/operacao/caixa">Abrir caixa</a></article>
        {isManager && <article><small>GESTÃO</small><strong>Funcionários</strong><p>Cadastre e mantenha os acessos da equipe.</p><a href="/operacao/funcionarios">Abrir gestão</a></article>}
      </section>
    </div>
  );
}
