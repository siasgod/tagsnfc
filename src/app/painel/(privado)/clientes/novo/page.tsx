import { ClienteForm } from "./ClienteForm";

export default function PaginaNovoCliente() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-lg font-semibold">Novo cliente</h1>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <ClienteForm />
      </div>
    </div>
  );
}
