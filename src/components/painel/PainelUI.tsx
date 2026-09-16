import Link from "next/link";

export function CabecalhoPagina({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="min-w-0">
        <h1>{titulo}</h1>
        {descricao ? <p>{descricao}</p> : null}
      </div>
      {acao ? <div className="page-header-action">{acao}</div> : null}
    </header>
  );
}

export function Secao({
  titulo,
  descricao,
  acao,
  children,
  className = "",
}: {
  titulo?: string;
  descricao?: string;
  acao?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`surface ${className}`}>
      {titulo || acao ? (
        <div className="surface-header">
          <div>
            {titulo ? <h2>{titulo}</h2> : null}
            {descricao ? <p>{descricao}</p> : null}
          </div>
          {acao}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function CartaoMetrica({
  rotulo,
  valor,
  detalhe,
  tom = "neutro",
}: {
  rotulo: string;
  valor: string | number;
  detalhe?: string;
  tom?: "neutro" | "azul" | "verde" | "ambar" | "violeta";
}) {
  return (
    <article className={`stat-card stat-${tom}`}>
      <div className="stat-accent" aria-hidden="true" />
      <p className="stat-label">{rotulo}</p>
      <p className="stat-value">{valor}</p>
      {detalhe ? <p className="stat-detail">{detalhe}</p> : null}
    </article>
  );
}

const CORES: Record<string, string> = {
  AZUL: "badge-blue",
  VERDE: "badge-green",
  VIOLETA: "badge-violet",
  AMBAR: "badge-amber",
  ROSA: "badge-pink",
  CINZA: "badge-slate",
  ATIVA: "badge-green",
  QUITADA: "badge-green",
  DISPONIVEL: "badge-blue",
  PARCIAL: "badge-amber",
  PENDENTE: "badge-amber",
  DESATIVADA: "badge-slate",
  ADMIN: "badge-violet",
  GERENTE: "badge-blue",
  VENDEDOR: "badge-green",
  VISUALIZADOR: "badge-slate",
  QR: "badge-blue",
  NFC: "badge-violet",
};

export function Badge({ children, tom }: { children: React.ReactNode; tom?: string | null }) {
  return <span className={`badge ${CORES[tom ?? ""] ?? "badge-slate"}`}>{children}</span>;
}

export function EstadoVazio({
  titulo,
  descricao,
  href,
  acao,
}: {
  titulo: string;
  descricao: string;
  href?: string;
  acao?: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon" aria-hidden="true">◇</div>
      <h3>{titulo}</h3>
      <p>{descricao}</p>
      {href && acao ? <Link href={href} className="button button-secondary">{acao}</Link> : null}
    </div>
  );
}
