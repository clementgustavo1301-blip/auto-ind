import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface AuthResult {
  user: User | null;
  session: Session | null;
  error: string | null;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(supabase);
}

export function mapAuthErrorMessage(rawMessage: string): string {
  const normalized = rawMessage.toLowerCase();

  if (
    normalized.includes('invalid login credentials') ||
    normalized.includes('invalid_credentials') ||
    normalized.includes('user not found')
  ) {
    return 'Credenciais inválidas ou operador não provisionado no banco de dados.';
  }

  if (normalized.includes('email not confirmed')) {
    return 'E-mail ainda não confirmado no Supabase Auth. Ative o usuário no painel do banco.';
  }

  if (normalized.includes('too many requests') || normalized.includes('rate limit')) {
    return 'Muitas tentativas consecutivas. Aguarde alguns instantes antes de tentar novamente.';
  }

  if (normalized.includes('network') || normalized.includes('fetch')) {
    return 'Falha de comunicação com o servidor de autenticação. Verifique sua conexão.';
  }

  return 'Não foi possível autenticar. Verifique suas credenciais junto ao administrador do banco.';
}

export async function signInOperator(email: string, password: string): Promise<AuthResult> {
  if (!supabase) {
    return {
      user: null,
      session: null,
      error:
        'Cliente Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no arquivo .env.local.',
    };
  }

  const sanitizedEmail = email.trim().toLowerCase();
  if (!sanitizedEmail || !password) {
    return {
      user: null,
      session: null,
      error: 'Preencha o e-mail corporativo e a chave de acesso.',
    };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: sanitizedEmail,
      password,
    });

    if (error) {
      return {
        user: null,
        session: null,
        error: mapAuthErrorMessage(error.message),
      };
    }

    return {
      user: data.user,
      session: data.session,
      error: null,
    };
  } catch {
    return {
      user: null,
      session: null,
      error: 'Erro inesperado ao validar sessão criptográfica.',
    };
  }
}

export async function signOutOperator(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getOperatorSession(): Promise<Session | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session;
  } catch {
    return null;
  }
}
