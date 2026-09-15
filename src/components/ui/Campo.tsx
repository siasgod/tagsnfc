export function Campo({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  placeholder,
  autoComplete,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  step?: string;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      {required && <span className="text-red-500"> *</span>}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        step={step}
        className="botao-toque mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
    </label>
  );
}
