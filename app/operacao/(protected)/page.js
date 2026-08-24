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
        <p>{isManager ? "Acompanhe o caixa e gerencie a equipe do turno." : "Delivery, comandas e vendas rápidas ficarão centralizados aqui."}</p>
      </header>

      <section className={styles.cards}>
        <article><small>DELIVERY</small><strong>Pedidos</strong><p>Aceitação e acompanhamento dos pedidos recebidos pelo site.</p><em>Próxima etapa</em></article>
        <article><small>MESAS</small><strong>Comandas</strong><p>Recebimento e fechamento das comandas internas.</p><em>Próxima etapa</em></article>
        <article><small>CAIXA</small><strong>Venda avulsa</strong><p>Venda presencial direta, pagamento e identificação do responsável.</p><em>Próxima etapa</em></article>
        {isManager && <article><small>GESTÃO</small><strong>Funcionários</strong><p>Cadastre e mantenha os acessos da equipe.</p><a href="/operacao/funcionarios">Abrir gestão</a></article>}
      </section>
    </div>
  );
}
