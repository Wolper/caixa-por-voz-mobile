export type CategoryType = 'receita' | 'despesa' | string;

export type Category = {
  id: string;
  name: string;
  type?: CategoryType | null;
};
