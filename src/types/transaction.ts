export type TransactionType = 'receita' | 'despesa' | 'conta_a_pagar' | 'conta_a_receber' | string;

export type Transaction = {
  id: string;
  company_id?: string | null;
  category_id?: string | null;
  categoryName?: string | null;
  description?: string | null;
  tipo?: TransactionType | null;
  type?: TransactionType | null;
  amount?: number | string | null;
  value?: number | string | null;
  date?: string | null;
  transaction_date?: string | null;
  due_date?: string | null;
  vencimento?: string | null;
  status?: string | null;
  supplier_customer?: string | null;
  payment_method?: string | null;
  created_at?: string | null;
};
