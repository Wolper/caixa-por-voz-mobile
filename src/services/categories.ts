import { supabase } from '../lib/supabase';
import type { ControlProfileType } from '../types/control';

export type DefaultCategoryType = 'receita' | 'despesa';

export type CategoryRow = {
  id: string;
  name: string;
  type?: DefaultCategoryType | string | null;
  company_id?: string | null;
};

const CATEGORY_SELECT_FIELDS = 'id, name, type, company_id';
const CONTROL_PROFILE_SELECT_FIELDS = 'id, profile_type';
const FALLBACK_PROFILE_TYPE: ControlProfileType = 'empresa';

export const DEFAULT_CATEGORIES_BY_PROFILE: Record<ControlProfileType, Record<DefaultCategoryType, string[]>> = {
  pessoal: {
    receita: ['Salário', 'Renda extra', 'Reembolsos', 'Vendas ocasionais', 'Outros recebimentos'],
    despesa: [
      'Alimentação',
      'Mercado',
      'Moradia/Aluguel',
      'Energia',
      'Água',
      'Internet e telefone',
      'Transporte',
      'Saúde',
      'Educação',
      'Lazer',
      'Cartão',
      'Outras despesas',
    ],
  },
  empresa: {
    receita: ['Vendas', 'Serviços', 'Recebimentos', 'Outros recebimentos'],
    despesa: [
      'Insumos',
      'Mercadorias',
      'Aluguel',
      'Energia',
      'Água',
      'Internet e telefone',
      'Transporte e logística',
      'Funcionários',
      'Taxas e impostos',
      'Manutenção',
      'Marketing',
      'Outras despesas',
    ],
  },
};

export const DEFAULT_CATEGORIES = DEFAULT_CATEGORIES_BY_PROFILE.empresa;
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

function normalizeProfileType(profileType?: string | null): ControlProfileType {
  return profileType === 'pessoal' || profileType === 'empresa' ? profileType : FALLBACK_PROFILE_TYPE;
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

export function getDefaultCategoriesForProfile(profileType?: string | null) {
  return DEFAULT_CATEGORIES_BY_PROFILE[normalizeProfileType(profileType)];
}

export function controlHasCategoriesForAllDefaultTypes(categories: CategoryRow[], profileType?: string | null) {
  const defaultCategories = getDefaultCategoriesForProfile(profileType);

  return DEFAULT_CATEGORY_TYPES.every((categoryType) => {
    const existingNames = new Set(
      categories
        .filter((category) => category.type === categoryType)
        .map((category) => normalizeCategoryName(category.name)),
    );

    return defaultCategories[categoryType].every((categoryName) => existingNames.has(normalizeCategoryName(categoryName)));
  });
}

export function filterCategoriesForProfile(categories: CategoryRow[], profileType?: string | null) {
  const defaultCategories = getDefaultCategoriesForProfile(profileType);
  const allowedDefaultKeys = new Set(
    DEFAULT_CATEGORY_TYPES.flatMap((categoryType) =>
      defaultCategories[categoryType].map((categoryName) => `${categoryType}:${normalizeCategoryName(categoryName)}`),
    ),
  );
  const allDefaultKeys = new Set(
    Object.values(DEFAULT_CATEGORIES_BY_PROFILE).flatMap((profileCategories) =>
      DEFAULT_CATEGORY_TYPES.flatMap((categoryType) =>
        profileCategories[categoryType].map((categoryName) => `${categoryType}:${normalizeCategoryName(categoryName)}`),
      ),
    ),
  );

  return categories.filter((category) => {
    if (category.type !== 'receita' && category.type !== 'despesa') {
      return true;
    }

    const categoryKey = `${category.type}:${normalizeCategoryName(category.name)}`;

    return allowedDefaultKeys.has(categoryKey) || !allDefaultKeys.has(categoryKey);
  });
}

export async function loadControlProfileTypeForCategories(companyId: string) {
  const { data, error } = await supabase
    .from('companies')
    .select(CONTROL_PROFILE_SELECT_FIELDS)
    .eq('id', companyId)
    .maybeSingle();

  if (error) {
    warnExpectedCategoryError('Erro esperado ao carregar perfil do controle para categorias', error);
    throw error;
  }

  return normalizeProfileType(data?.profile_type);
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

export async function prepareDefaultCategoriesForControl(companyId: string, profileType?: string | null) {
  const normalizedProfileType = profileType ? normalizeProfileType(profileType) : await loadControlProfileTypeForCategories(companyId);
  const defaultCategories = getDefaultCategoriesForProfile(normalizedProfileType);
  const existingCategories = await loadCategoriesForControl(companyId);
  const existingKeys = new Set(
    existingCategories
      .filter((category) => category.type === 'receita' || category.type === 'despesa')
      .map((category) => `${category.type}:${normalizeCategoryName(category.name)}`),
  );

  const categoriesToInsert = DEFAULT_CATEGORY_TYPES.flatMap((categoryType) =>
    defaultCategories[categoryType]
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
