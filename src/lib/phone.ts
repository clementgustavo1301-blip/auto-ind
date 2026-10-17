import { checkWhatsAppNumbers } from './whatsapp';

/**
 * Prepares a phone number for the WhatsApp service without assuming a country.
 * Keeps an explicit international marker ("+" or "00") so the backend can
 * distinguish "+51 987..." (Peru) from "51 987..." (Porto Alegre, BR).
 * Country detection (+55 for bare Brazilian numbers) happens in whatsapp-service.
 */
export function toDialablePhone(raw: string): string {
  const trimmed = (raw || '').trim();
  let digits = trimmed.replace(/\D/g, '');
  let international = trimmed.startsWith('+');

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
    international = true;
  }

  if (!digits) return '';
  return international ? `+${digits}` : digits;
}

/** Renders a phone for display with exactly one leading "+". */
export function formatPhoneDisplay(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

export const BRAZILIAN_DDDS = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '21', '22', '24', '27', '28',
  '31', '32', '33', '34', '35', '37', '38',
  '41', '42', '43', '44', '45', '46', '47', '48', '49',
  '51', '53', '54', '55',
  '61', '62', '63', '64', '65', '66', '67', '68', '69',
  '71', '73', '74', '75', '77', '79',
  '81', '82', '83', '84', '85', '86', '87', '88', '89',
  '91', '92', '93', '94', '95', '96', '97', '98', '99',
]);

const NON_MOBILE_PREFIXES = ['0800', '0300', '4004', '3003', '4003', '4002'];

/**
 * Avalia se um número de telefone é um CELULAR plausível e apto a WhatsApp,
 * descartando expressamente linhas de TELEFONE FIXO e prefixos corporativos.
 */
export function isLikelyMobilePhone(raw?: string, countryHint?: string): boolean {
  if (!raw) return false;
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 8) return false;

  // Rejeita 0800, 0300, 4004 etc
  for (const prefix of NON_MOBILE_PREFIXES) {
    if (digits.startsWith(prefix) || digits.startsWith('55' + prefix)) {
      return false;
    }
  }

  const isExplicitIntl = trimmed.startsWith('+') || digits.startsWith('00');
  const d = digits.startsWith('00') ? digits.slice(2) : digits;

  // 1. BRASIL
  // Caso venha com DDI 55
  if (d.startsWith('55')) {
    const after55 = d.slice(2);
    // 11 dígitos após o 55: DDD (2) + 9 dígitos celular
    if (after55.length === 11) {
      const ddd = after55.slice(0, 2);
      const firstNum = after55[2];
      if (BRAZILIAN_DDDS.has(ddd) && firstNum === '9') {
        return true;
      }
    }
    // 10 dígitos após o 55: DDD (2) + 8 dígitos
    if (after55.length === 10) {
      const firstNum = after55[2];
      if (['2', '3', '4', '5'].includes(firstNum)) {
        return false; // Fixo comprovado (ex: 3222-1234)
      }
      if (['6', '7', '8', '9'].includes(firstNum)) {
        return true; // Celular de 8 dígitos
      }
    }
    if (after55.length < 10) {
      return false;
    }
  }

  // Caso seja Brasil sem DDI (ou país hint Brasil)
  const isBrazilHint = !countryHint || /brasil|brazil/i.test(countryHint);
  if (!isExplicitIntl || isBrazilHint) {
    // 11 dígitos nacionais: DDD (2) + 9XXXX-XXXX
    if (d.length === 11) {
      const ddd = d.slice(0, 2);
      const firstNum = d[2];
      if (BRAZILIAN_DDDS.has(ddd) && firstNum === '9') {
        return true;
      }
    }
    // 10 dígitos nacionais: DDD (2) + 8 dígitos
    if (d.length === 10) {
      const ddd = d.slice(0, 2);
      const firstNum = d[2];
      if (BRAZILIAN_DDDS.has(ddd)) {
        if (['2', '3', '4', '5'].includes(firstNum)) {
          return false; // Fixo comprovado
        }
        if (['6', '7', '8', '9'].includes(firstNum)) {
          return true; // Celular de 8 dígitos
        }
      }
    }
    // 8 ou 9 dígitos sem DDD são incompletos para envio
    if (d.length <= 9 && isBrazilHint) {
      return false;
    }
  }

  // 2. FRANÇA (+33)
  if (d.startsWith('33')) {
    const after33 = d.slice(2);
    // Celulares franceses: começam com 6 ou 7
    if (after33.startsWith('6') || after33.startsWith('7')) return true;
    // Fixos franceses: começam com 1, 2, 3, 4, 5, 8, 9
    if (/^[1-589]/.test(after33)) return false;
  }
  // Local francês (10 dígitos começando com 0)
  if (d.length === 10 && d.startsWith('0')) {
    if (d.startsWith('06') || d.startsWith('07')) return true;
    if (/^0[1-589]/.test(d)) return false;
  }

  // 3. REINO UNIDO (+44)
  if (d.startsWith('44')) {
    const after44 = d.slice(2);
    if (after44.startsWith('7')) return true;
    if (/^[123]/.test(after44)) return false;
  }
  if (d.startsWith('07') && d.length === 11) return true;

  // 4. ESPANHA (+34)
  if (d.startsWith('34')) {
    const after34 = d.slice(2);
    if (after34.startsWith('6') || after34.startsWith('7')) return true;
    if (after34.startsWith('8') || after34.startsWith('9')) return false;
  }

  // 5. PORTUGAL (+351)
  if (d.startsWith('351')) {
    const after351 = d.slice(3);
    if (after351.startsWith('9')) return true;
    if (after351.startsWith('2')) return false;
  }

  // 6. ITÁLIA (+39)
  if (d.startsWith('39')) {
    const after39 = d.slice(2);
    if (after39.startsWith('3')) return true;
    if (after39.startsWith('0')) return false;
  }

  // 7. ALEMANHA (+49)
  if (d.startsWith('49')) {
    const after49 = d.slice(2);
    if (after49.startsWith('15') || after49.startsWith('16') || after49.startsWith('17')) return true;
    return false;
  }

  // 8. ARGENTINA (+54)
  if (d.startsWith('54')) {
    const after54 = d.slice(2);
    if (after54.startsWith('9')) return true;
    return false;
  }

  // 9. EUA / CANADÁ (+1)
  if (d.startsWith('1') && d.length === 11) {
    const areaCode = d.slice(1, 4);
    const tollFree = ['800', '888', '877', '866', '855', '844', '833'];
    if (tollFree.includes(areaCode)) return false;
    return true;
  }

  // 10. Outros com DDI internacional explícito e tamanho aceitável
  if (isExplicitIntl && d.length >= 9 && d.length <= 15) {
    return true;
  }

  return false;
}

/**
 * Filtra uma lista de leads, descartando aqueles que não possuem WhatsApp:
 * 1. Remove quem não tem telefone ou cujo número é comprovadamente telefone fixo.
 * 2. Se o microserviço Whatsmeow estiver conectado, consulta em lote no WhatsApp
 *    e descarta os números que não possuem conta ativa registrada.
 */
export async function filterLeadsWithWhatsApp<T extends { whatsapp?: string; country?: string }>(
  leads: T[]
): Promise<T[]> {
  if (!leads || leads.length === 0) return [];

  // Passo 1: Filtragem estática (apenas celulares plausíveis, sem telefones fixos)
  const candidates = leads.filter(l => Boolean(l.whatsapp && isLikelyMobilePhone(l.whatsapp, l.country)));

  if (candidates.length === 0) return [];

  // Passo 2: Verificação live se o microserviço Whatsmeow estiver online e autenticado
  try {
    const phonesToCheck = candidates
      .map(c => c.whatsapp?.trim() || '')
      .filter(Boolean);

    const checkResults = await checkWhatsAppNumbers(phonesToCheck);

    // Se o microserviço retornou respostas
    if (checkResults && Object.keys(checkResults).length > 0) {
      const verified = candidates.filter(c => {
        const p = c.whatsapp?.trim() || '';
        return checkResults[p] === true;
      });
      if (verified.length > 0) {
        return verified;
      }
    }
  } catch (err) {
    // Fallback: mantém candidatos aprovados na filtragem estática
  }

  return candidates;
}
