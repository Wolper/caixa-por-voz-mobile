export type ParsedTransactionType = 'receita' | 'despesa';
export type ParsedTransactionStatus = 'pago' | 'pendente';

export type ParsedTextTransaction = {
  type: ParsedTransactionType | null;
  description: string;
  amount: number | null;
  transactionDate: string;
  dueDate: string | null;
  paymentMethod: string | null;
  status: ParsedTransactionStatus;
  suggestedCategoryName: string | null;
  confidenceMessages: string[];
};

const incomeWords = ['recebi', 'recebido', 'vendi', 'venda', 'entrada', 'pagaram', 'serviço', 'servico'];
const expenseWords = ['comprei', 'paguei', 'pagamento', 'despesa', 'gastei', 'conta de', 'conta'];
const paymentMethods = [
  { label: 'Pix', words: ['pix'] },
  { label: 'Dinheiro', words: ['dinheiro', 'espécie', 'especie'] },
  { label: 'Cartão', words: ['cartão', 'cartao', 'crédito', 'credito', 'débito', 'debito'] },
  { label: 'Boleto', words: ['boleto'] },
];
const categoryRules = [
  { name: 'insumos', words: ['frango', 'carne', 'mercado', 'ingrediente', 'ingredientes'] },
  { name: 'contas', words: ['energia', 'água', 'agua', 'internet'] },
  { name: 'aluguel', words: ['aluguel'] },
  { name: 'vendas/serviços', words: ['venda', 'vendi', 'serviço', 'servico'] },
];

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

function localIsoDateFromDate(date: Date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function addLocalDays(baseDate: Date, days: number) {
  return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + days);
}

function inferType(normalizedPhrase: string): ParsedTransactionType | null {
  const hasIncomeWord = incomeWords.some((word) => normalizedPhrase.includes(normalizeText(word)));
  const hasExpenseWord = expenseWords.some((word) => normalizedPhrase.includes(normalizeText(word)));

  if (hasIncomeWord && !hasExpenseWord) return 'receita';
  if (hasExpenseWord && !hasIncomeWord) return 'despesa';
  if (hasIncomeWord) return 'receita';
  if (hasExpenseWord) return 'despesa';

  return null;
}

function parseAmount(phrase: string): number | null {
  const amountMatches = Array.from(
    phrase.matchAll(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+,\d{1,2}|\d+\.\d{1,2}|\d+)(?:\s*(?:reais|real))?/gi),
  );

  for (const match of amountMatches) {
    const rawValue = match[1];
    const matchIndex = match.index ?? 0;
    const before = phrase.slice(Math.max(0, matchIndex - 16), matchIndex).toLowerCase();

    if (/dia\s*$/.test(before) || /vence\s*$/.test(before) || /vencendo\s*$/.test(before)) {
      continue;
    }

    const normalized = rawValue.includes(',')
      ? rawValue.replace(/\./g, '').replace(',', '.')
      : rawValue.replace(/(?<=\d)\.(?=\d{3}(\D|$))/g, '');
    const amount = Number(normalized);

    if (Number.isFinite(amount) && amount > 0) {
      return amount;
    }
  }

  return null;
}

function inferTransactionDate(normalizedPhrase: string, now: Date) {
  if (normalizedPhrase.includes('ontem')) {
    return localIsoDateFromDate(addLocalDays(now, -1));
  }

  if (normalizedPhrase.includes('amanha')) {
    return localIsoDateFromDate(addLocalDays(now, 1));
  }

  return localIsoDateFromDate(now);
}

function inferDueDate(normalizedPhrase: string, now: Date) {
  const dueDayMatch = /(?:vencendo|vence|vencimento)\s+(?:no\s+)?dia\s+(\d{1,2})/.exec(normalizedPhrase);

  if (!dueDayMatch) {
    return null;
  }

  const day = Number(dueDayMatch[1]);
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  if (!Number.isInteger(day) || day < 1 || day > lastDayOfMonth) {
    return null;
  }

  return localIsoDateFromDate(new Date(now.getFullYear(), now.getMonth(), day));
}

function inferPaymentMethod(normalizedPhrase: string) {
  const paymentMethod = paymentMethods.find((method) =>
    method.words.some((word) => normalizedPhrase.includes(normalizeText(word))),
  );

  return paymentMethod?.label ?? null;
}

function inferCategory(normalizedPhrase: string) {
  const category = categoryRules.find((rule) =>
    rule.words.some((word) => normalizedPhrase.includes(normalizeText(word))),
  );

  return category?.name ?? null;
}

function buildDescription(phrase: string) {
  const cleaned = phrase
    .replace(/\b(hoje|ontem|amanh[ãa])\b/gi, '')
    .replace(/\b(no\s+)?pix\b/gi, '')
    .replace(/\b(em\s+)?dinheiro\b/gi, '')
    .replace(/\b(no\s+)?cart[aã]o\b/gi, '')
    .replace(/\b(no\s+)?boleto\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || phrase.trim();
}

export function parseTextTransaction(phrase: string, now = new Date()): ParsedTextTransaction {
  const normalizedPhrase = normalizeText(phrase);
  const type = inferType(normalizedPhrase);
  const amount = parseAmount(phrase);
  const dueDate = inferDueDate(normalizedPhrase, now);
  const paymentMethod = inferPaymentMethod(normalizedPhrase);
  const status: ParsedTransactionStatus = dueDate || normalizedPhrase.includes('pendente') ? 'pendente' : 'pago';
  const confidenceMessages: string[] = [];

  if (!type) {
    confidenceMessages.push('Não encontrei com segurança se é receita ou despesa. Ajuste o tipo antes de salvar.');
  }

  if (!amount) {
    confidenceMessages.push('Não encontrei um valor com segurança. Informe o valor antes de salvar.');
  }

  return {
    type,
    description: buildDescription(phrase),
    amount,
    transactionDate: inferTransactionDate(normalizedPhrase, now),
    dueDate,
    paymentMethod,
    status,
    suggestedCategoryName: inferCategory(normalizedPhrase),
    confidenceMessages,
  };
}
