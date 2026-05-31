import { supabase } from '../lib/supabase';

export type DefaultCategoryType = 'receita' | 'despesa';

export type CategoryRow = {
  id: string;
  name: string;
  type?: DefaultCategoryType | string | null;
  company_id?: string | null;
};

const CATEGORY_SELECT_FIELDS = 'id, name, type, company_id';

export const DEFAULT_CATEGORIES: Record<DefaultCategoryType, string[]> = {
  receita: ['Vendas', 'Serviços', 'Recebimentos', 'Outros recebimentos'],
  despesa: [
    'Insumos',
    'Mercadorias',
    'Aluguel',
    'Energia',
    'Água',
    'Internet e telefone',
    'Transporte',
    'Salários',
    'Taxas',
    'Manutenção',
    'Outras despesas',
  ],
};

export const DEFAULT_CATEGORY_TYPES = Object.keys(DEFAULT_CATEGORIES) as DefaultCategoryType[];

type SupabaseErrorLike = {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

function normalizeCategoryName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function warnExpectedCategoryError(context: string, error: SupabaseErrorLike | null) {
  if (__DEV__ && error) {
    console.warn(context, {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
  }
}

export function controlHasCategoriesForAllDefaultTypes(categories: CategoryRow[]) {
  return DEFAULT_CATEGORY_TYPES.every((categoryType) =>
    categories.some((category) => category.type === categoryType),
  );
}

export async function loadCategoriesForControl(companyId: string) {
  const { data, error } = await supabase
    .from('categories')
    .select(CATEGORY_SELECT_FIELDS)
    .eq('company_id', companyId)
    .order('name', { ascending: true });

  if (error) {
    warnExpectedCategoryError('Erro esperado ao carregar categorias do controle', error);
    throw error;
  }

  return (data ?? []) as CategoryRow[];
}

export async function prepareDefaultCategoriesForControl(companyId: string) {
  const existingCategories = await loadCategoriesForControl(companyId);
  const existingKeys = new Set(
    existingCategories
      .filter((category) => category.type === 'receita' || category.type === 'despesa')
      .map((category) => `${category.type}:${normalizeCategoryName(category.name)}`),
  );

  const categoriesToInsert = DEFAULT_CATEGORY_TYPES.flatMap((categoryType) =>
    DEFAULT_CATEGORIES[categoryType]
      .filter((categoryName) => !existingKeys.has(`${categoryType}:${normalizeCategoryName(categoryName)}`))
      .map((categoryName) => ({
        company_id: companyId,
        name: categoryName,
        type: categoryType,
      })),
  );

  if (categoriesToInsert.length === 0) {
    return existingCategories;
  }

  const { data, error } = await supabase
    .from('categories')
    .insert(categoriesToInsert)
    .select(CATEGORY_SELECT_FIELDS);

  if (error) {
    warnExpectedCategoryError('Erro esperado ao preparar categorias padrão do controle', error);
    throw error;
  }

  return [...existingCategories, ...((data ?? []) as CategoryRow[])].sort((first, second) => first.name.localeCompare(second.name));
}
