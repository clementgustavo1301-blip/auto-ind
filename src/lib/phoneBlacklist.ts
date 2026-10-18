import { cleanPhoneDigits, isSamePhone, toDialablePhone } from './phone';

/**
 * Gerenciador de lista de supressão / bloqueio de telefones.
 * Garante que contatos excluídos nunca recebam novas mensagens:
 * 1. O robô autônomo nunca seleciona esses contatos para disparo.
 * 2. O minerador do Google nunca re-importa esses números.
 * 3. O microserviço e sendWhatsAppMessage abortam qualquer tentativa de envio.
 * 4. Se o contato enviar mensagem no WhatsApp, o AI SDR ignora e não responde nem recria o lead.
 */

const g = (typeof globalThis !== 'undefined' ? globalThis : global) as any;
if (!g.__deletedPhonesSet) {
  g.__deletedPhonesSet = new Set<string>();
}

export function isBlacklistedPhone(candidatePhone?: string | null): boolean {
  if (!candidatePhone) return false;
  const raw = candidatePhone.trim();
  const digits = cleanPhoneDigits(raw);
  if (!digits) return false;

  const set: Set<string> = g.__deletedPhonesSet;
  if (set.has(digits) || set.has(raw)) {
    return true;
  }

  // Compara com números armazenados no Set usando heurística completa (DDD + 8 dígitos)
  for (const stored of set) {
    if (isSamePhone(raw, stored)) {
      return true;
    }
  }

  // Verificação rápida de sufixo de 8 dígitos para celular brasileiro
  if (digits.length >= 8) {
    const s8 = digits.slice(-8);
    for (const stored of set) {
      const sDigits = cleanPhoneDigits(stored);
      if (sDigits.length >= 8 && sDigits.slice(-8) === s8) {
        return true;
      }
    }
  }

  return false;
}

export function addPhoneToBlacklist(phone?: string | null): void {
  if (!phone) return;
  const raw = phone.trim();
  const digits = cleanPhoneDigits(raw);
  const normalized = toDialablePhone(raw);
  const set: Set<string> = g.__deletedPhonesSet;

  if (raw) set.add(raw);
  if (digits) set.add(digits);
  if (normalized) set.add(normalized);
}

export function removePhoneFromBlacklist(phone?: string | null): void {
  if (!phone) return;
  const raw = phone.trim();
  const digits = cleanPhoneDigits(raw);
  const set: Set<string> = g.__deletedPhonesSet;

  set.delete(raw);
  if (digits) set.delete(digits);
  for (const stored of Array.from(set)) {
    if (isSamePhone(stored, raw)) {
      set.delete(stored);
    }
  }
}

export function getBlacklistedPhones(): string[] {
  const set: Set<string> = g.__deletedPhonesSet;
  return Array.from(set);
}

export function loadBlacklistedPhones(phones?: string[] | null): void {
  if (!Array.isArray(phones)) return;
  for (const p of phones) {
    addPhoneToBlacklist(p);
  }
}
