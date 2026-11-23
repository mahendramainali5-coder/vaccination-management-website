import type { AppFilterState, AppView, ExplorerTab } from '../types/database';

export const ALL_COUNTRY_CODES = ['KOR', 'JPN', 'CHN', 'IND', 'NPL'] as const;

export const ROUTINE_YEAR_MIN = 2016;
export const ROUTINE_YEAR_MAX = 2025;
export const COVID_YEAR_MIN = 2021;
export const COVID_YEAR_MAX = 2025;

export const VACCINE_TO_DEFAULT_DISEASE: Record<string, string> = {
  HepB3: 'HEPB',
  MCV1: 'MEASLES',
  DTP3: 'DIPHTHERIA',
  IPV1: 'POLIO',
  COVID19_PRIMARY: 'COVID19',
};

export const VACCINE_TO_ALLOWED_DISEASES: Record<string, string[]> = {
  HepB3: ['HEPB'],
  MCV1: ['MEASLES'],
  DTP3: ['DIPHTHERIA', 'TETANUS', 'PERTUSSIS'],
  IPV1: ['POLIO'],
  COVID19_PRIMARY: ['COVID19'],
};

export const DEFAULT_FILTER_STATE: AppFilterState = {
  view: 'dashboard',
  vaccineCode: 'MCV1',
  diseaseCode: 'MEASLES',
  countryCodes: [...ALL_COUNTRY_CODES],
  yearFrom: ROUTINE_YEAR_MIN,
  yearTo: ROUTINE_YEAR_MAX,
  explorerTab: 'coverage',
};

export function getYearBoundsForVaccine(vaccineCode: string): { min: number; max: number } {
  if (vaccineCode === 'COVID19_PRIMARY') {
    return { min: COVID_YEAR_MIN, max: COVID_YEAR_MAX };
  }
  return { min: ROUTINE_YEAR_MIN, max: ROUTINE_YEAR_MAX };
}

export function parseFilterStateFromUrl(search: string): AppFilterState {
  const params = new URLSearchParams(search);

  const rawView = params.get('view');
  const view: AppView =
    rawView === 'dashboard' || rawView === 'explorer' || rawView === 'design'
      ? rawView
      : DEFAULT_FILTER_STATE.view;

  const rawVaccine = params.get('vaccine');
  const vaccineCode =
    rawVaccine && rawVaccine in VACCINE_TO_DEFAULT_DISEASE
      ? rawVaccine
      : DEFAULT_FILTER_STATE.vaccineCode;

  const allowedDiseases = VACCINE_TO_ALLOWED_DISEASES[vaccineCode];
  const rawDisease = params.get('disease');
  const diseaseCode =
    rawDisease && allowedDiseases.includes(rawDisease)
      ? rawDisease
      : VACCINE_TO_DEFAULT_DISEASE[vaccineCode];

  const rawCountries = params.get('countries');
  let countryCodes: string[] = [...ALL_COUNTRY_CODES];
  if (rawCountries !== null) {
    if (rawCountries.trim() === '') {
      countryCodes = [];
    } else {
      const parsed = rawCountries
        .split(',')
        .map((c) => c.trim().toUpperCase())
        .filter((c) => (ALL_COUNTRY_CODES as readonly string[]).includes(c));
      countryCodes = parsed.length > 0 ? Array.from(new Set(parsed)) : [...ALL_COUNTRY_CODES];
    }
  }

  const bounds = getYearBoundsForVaccine(vaccineCode);
  const parsedFrom = Number(params.get('from'));
  const parsedTo = Number(params.get('to'));

  let yearFrom =
    Number.isInteger(parsedFrom) && parsedFrom >= bounds.min && parsedFrom <= bounds.max
      ? parsedFrom
      : bounds.min;
  let yearTo =
    Number.isInteger(parsedTo) && parsedTo >= bounds.min && parsedTo <= bounds.max
      ? parsedTo
      : bounds.max;
  if (yearFrom > yearTo) {
    yearFrom = bounds.min;
    yearTo = bounds.max;
  }

  const rawTab = params.get('tab');
  const explorerTab: ExplorerTab =
    rawTab === 'cases' || rawTab === 'coverage' ? rawTab : 'coverage';

  return {
    view,
    vaccineCode,
    diseaseCode,
    countryCodes,
    yearFrom,
    yearTo,
    explorerTab,
  };
}

export function serializeFilterStateToUrl(state: AppFilterState): string {
  const params = new URLSearchParams();
  params.set('view', state.view);
  params.set('vaccine', state.vaccineCode);
  if (state.vaccineCode === 'DTP3') {
    params.set('disease', state.diseaseCode);
  }
  params.set('countries', state.countryCodes.join(','));
  params.set('from', String(state.yearFrom));
  params.set('to', String(state.yearTo));
  if (state.view === 'explorer') {
    params.set('tab', state.explorerTab);
  }
  return `?${params.toString()}`;
}
