export type CategoryType = 'receita' | 'despesa' | string;

export type Category = {
  id: string;
  name: string;
  type?: CategoryType | null;
  company_id?: string | null;
};
