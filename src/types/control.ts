export type ControlProfileType = 'pessoal' | 'empresa';

export type Control = {
  id: string;
  name: string;
  cnpj: string | null;
  profile_type: ControlProfileType;
};
