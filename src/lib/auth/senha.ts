import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function gerarHashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, SALT_ROUNDS);
}

export async function verificarSenha(
  senha: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

export function senhaEhForte(senha: string): { ok: boolean; motivo?: string } {
  if (senha.length < 10) {
    return { ok: false, motivo: "A senha deve ter pelo menos 10 caracteres." };
  }
  if (!/[a-z]/.test(senha) || !/[A-Z]/.test(senha) || !/[0-9]/.test(senha)) {
    return {
      ok: false,
      motivo: "A senha deve conter letras maiúsculas, minúsculas e números.",
    };
  }
  return { ok: true };
}
