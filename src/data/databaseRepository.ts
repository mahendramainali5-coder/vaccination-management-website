import rawData from './workbookData.json';
import type {
  CaseJoinedRow,
  CountryRow,
  CoverageJoinedRow,
  DataSourceRow,
  DiseaseRow,
  VaccineIndicatorRow,
  WorkbookDataset,
} from '../types/database';

const dataset = rawData as unknown as WorkbookDataset;

export type MarkerShape = 'circle' | 'square' | 'diamond' | 'triangle' | 'cross';

export interface CountryVisualStyle {
  code: string;
  name: string;
  color: string;
  softBg: string;
  shape: MarkerShape;
}

export const COUNTRY_STYLES: Record<string, CountryVisualStyle> = {
  KOR: { code: 'KOR', name: 'South Korea', color: '#1D4ED8', softBg: '#EFF6FF', shape: 'circle' },
  JPN: { code: 'JPN', name: 'Japan', color: '#C2410C', softBg: '#FFF7ED', shape: 'square' },
  CHN: { code: 'CHN', name: 'China', color: '#0F766E', softBg: '#F0FDFA', shape: 'diamond' },
  IND: { code: 'IND', name: 'India', color: '#7C3AED', softBg: '#F5F3FF', shape: 'triangle' },
  NPL: { code: 'NPL', name: 'Nepal', color: '#B45309', softBg: '#FFFBEB', shape: 'cross' },
};

// Build lookup maps keyed by primary key IDs (preserving normalized 3NF design)
const countryById = new Map<number, CountryRow>(
  dataset.tables.country.map((c) => [c.country_id, c]),
);
const countryByCode = new Map<string, CountryRow>(
  dataset.tables.country.map((c) => [c.country_code, c]),
);
const vaccineById = new Map<number, VaccineIndicatorRow>(
  dataset.tables.vaccine_indicator.map((v) => [v.vaccine_id, v]),
);
const vaccineByCode = new Map<string, VaccineIndicatorRow>(
  dataset.tables.vaccine_indicator.map((v) => [v.indicator_code, v]),
);
const diseaseById = new Map<number, DiseaseRow>(
  dataset.tables.disease.map((d) => [d.disease_id, d]),
);
const diseaseByCode = new Map<string, DiseaseRow>(
  dataset.tables.disease.map((d) => [d.disease_code, d]),
);
const sourceById = new Map<number, DataSourceRow>(
  dataset.tables.data_source.map((s) => [s.source_id, s]),
);
const weeksByCaseReportId = new Map<number, number | null>(
  dataset.tables.covid_reporting_weeks.map((w) => [w.case_report_id, w.weeks_reported]),
);

// M:N vaccine_disease lookup indexes
const diseaseIdsByVaccineId = new Map<number, number[]>();
const vaccineCodesByDiseaseId = new Map<number, string[]>();
for (const link of dataset.tables.vaccine_disease) {
  const dList = diseaseIdsByVaccineId.get(link.vaccine_id) ?? [];
  dList.push(link.disease_id);
  diseaseIdsByVaccineId.set(link.vaccine_id, dList);

  const v = vaccineById.get(link.vaccine_id);
  if (v) {
    const vList = vaccineCodesByDiseaseId.get(link.disease_id) ?? [];
    vList.push(v.indicator_code);
    vaccineCodesByDiseaseId.set(link.disease_id, vList);
  }
}

// Pre-joined views (strictly 1:1 with base fact tables — NEVER duplicating coverage across M:N diseases)
const allCoverageJoined: CoverageJoinedRow[] = dataset.tables.vaccination_coverage.map((vc) => {
  const country = countryById.get(vc.country_id)!;
  const vaccine = vaccineById.get(vc.vaccine_id)!;
  const source = sourceById.get(vc.source_id)!;
  return {
    record_id: vc.record_id,
    country_id: vc.country_id,
    country_code: country.country_code,
    country_name: country.country_name,
    vaccine_id: vc.vaccine_id,
    indicator_code: vaccine.indicator_code,
    vaccine_name: vaccine.vaccine_name,
    dose_series: vaccine.dose_series,
    vaccine_category: vaccine.vaccine_category,
    report_year: vc.report_year,
    coverage_percent: vc.coverage_percent,
    coverage_date: vc.coverage_date,
    source_id: vc.source_id,
    source_code: source.source_code,
    source_name: source.source_name,
    organization: source.organization,
    source_url: source.source_url,
  };
});

const allCasesJoined: CaseJoinedRow[] = dataset.tables.disease_case_count.map((dc) => {
  const country = countryById.get(dc.country_id)!;
  const disease = diseaseById.get(dc.disease_id)!;
  const source = sourceById.get(dc.source_id)!;
  const weeks = weeksByCaseReportId.has(dc.case_report_id)
    ? (weeksByCaseReportId.get(dc.case_report_id) ?? null)
    : null;
  return {
    case_report_id: dc.case_report_id,
    country_id: dc.country_id,
    country_code: country.country_code,
    country_name: country.country_name,
    disease_id: dc.disease_id,
    disease_code: disease.disease_code,
    disease_name: disease.disease_name,
    linked_indicator_codes: vaccineCodesByDiseaseId.get(dc.disease_id) ?? [],
    report_year: dc.report_year,
    reported_cases: dc.reported_cases,
    weeks_reported: weeks,
    source_id: dc.source_id,
    source_code: source.source_code,
    source_name: source.source_name,
    organization: source.organization,
    source_url: source.source_url,
  };
});

export function getDatasetMetadata() {
  return dataset.metadata;
}

export function getCountries(): CountryRow[] {
  return dataset.tables.country;
}

export function getVaccines(): VaccineIndicatorRow[] {
  return dataset.tables.vaccine_indicator;
}

export function getDiseases(): DiseaseRow[] {
  return dataset.tables.disease;
}

export function getDataSources(): DataSourceRow[] {
  return dataset.tables.data_source;
}

export function getVaccineByCode(code: string): VaccineIndicatorRow | undefined {
  return vaccineByCode.get(code);
}

export function getDiseaseByCode(code: string): DiseaseRow | undefined {
  return diseaseByCode.get(code);
}

export function getCountryByCode(code: string): CountryRow | undefined {
  return countryByCode.get(code);
}

export function getDiseasesForVaccineCode(indicatorCode: string): DiseaseRow[] {
  const v = vaccineByCode.get(indicatorCode);
  if (!v) return [];
  const dIds = diseaseIdsByVaccineId.get(v.vaccine_id) ?? [];
  return dIds.map((id) => diseaseById.get(id)!).filter(Boolean);
}

export function getAllCoverageRows(): CoverageJoinedRow[] {
  return allCoverageJoined;
}

export function getAllCaseRows(): CaseJoinedRow[] {
  return allCasesJoined;
}

export function filterCoverageRows(opts: {
  vaccineCode?: string; // 'ALL' or indicator_code
  countryCodes: string[];
  yearFrom: number;
  yearTo: number;
}): CoverageJoinedRow[] {
  const countrySet = new Set(opts.countryCodes);
  return allCoverageJoined.filter((r) => {
    if (opts.vaccineCode && opts.vaccineCode !== 'ALL' && r.indicator_code !== opts.vaccineCode) {
      return false;
    }
    if (!countrySet.has(r.country_code)) return false;
    if (r.report_year < opts.yearFrom || r.report_year > opts.yearTo) return false;
    return true;
  });
}

export function filterCaseRows(opts: {
  diseaseCode?: string; // 'ALL' or disease_code
  countryCodes: string[];
  yearFrom: number;
  yearTo: number;
}): CaseJoinedRow[] {
  const countrySet = new Set(opts.countryCodes);
  return allCasesJoined.filter((r) => {
    if (opts.diseaseCode && opts.diseaseCode !== 'ALL' && r.disease_code !== opts.diseaseCode) {
      return false;
    }
    if (!countrySet.has(r.country_code)) return false;
    if (r.report_year < opts.yearFrom || r.report_year > opts.yearTo) return false;
    return true;
  });
}

export interface LatestYearItem {
  country_code: string;
  country_name: string;
  coverage_percent: number | null;
  coverage_date: string | null;
  source_code: string;
  organization: string;
  source_url: string;
}

export function getYearComparisonForIndicator(
  vaccineCode: string,
  countryCodes: string[],
  year: number,
): LatestYearItem[] {
  const rows = filterCoverageRows({
    vaccineCode,
    countryCodes,
    yearFrom: year,
    yearTo: year,
  });
  const byCountry = new Map(rows.map((r) => [r.country_code, r]));
  // Preserve fixed study country order (do NOT rank countries with missing observations)
  return dataset.tables.country
    .filter((c) => countryCodes.includes(c.country_code))
    .map((c) => {
      const rec = byCountry.get(c.country_code);
      return {
        country_code: c.country_code,
        country_name: c.country_name,
        coverage_percent: rec ? rec.coverage_percent : null,
        coverage_date: rec ? rec.coverage_date : null,
        source_code: rec ? rec.source_code : 'Unavailable',
        organization: rec ? rec.organization : 'Unavailable',
        source_url: rec ? rec.source_url : '',
      };
    });
}

export function getLatestAvailableCoverageYear(
  vaccineCode: string,
  countryCodes: string[],
  yearFrom: number,
  yearTo: number,
): number | null {
  const rows = filterCoverageRows({ vaccineCode, countryCodes, yearFrom, yearTo });
  const yearsWithData = rows
    .filter((r) => r.coverage_percent !== null)
    .map((r) => r.report_year);
  if (yearsWithData.length === 0) return null;
  return Math.max(...yearsWithData);
}

export function getUniqueSourcesFromRows(
  rows: Array<{ source_id: number }>,
): DataSourceRow[] {
  const ids = Array.from(new Set(rows.map((r) => r.source_id)));
  return ids
    .map((id) => sourceById.get(id)!)
    .filter(Boolean)
    .sort((a, b) => a.source_id - b.source_id);
}

// ---------------------------------------------------------------------------
// Read-only SQL Example Query Runners (executed against bundled Workbook Data)
// ---------------------------------------------------------------------------

export function runExample1MeaslesByYear(year: number): CoverageJoinedRow[] {
  return allCoverageJoined
    .filter((r) => r.indicator_code === 'MCV1' && r.report_year === year)
    .sort((a, b) => a.country_id - b.country_id);
}

export function runExample2Dtp3DiseaseCounts(
  year: number,
  countryCode: string | 'ALL',
): CaseJoinedRow[] {
  const dtpDiseaseIds = new Set(diseaseIdsByVaccineId.get(vaccineByCode.get('DTP3')!.vaccine_id) ?? []);
  return allCasesJoined
    .filter((r) => {
      if (!dtpDiseaseIds.has(r.disease_id)) return false;
      if (r.report_year !== year) return false;
      if (countryCode !== 'ALL' && r.country_code !== countryCode) return false;
      return true;
    })
    .sort((a, b) => a.country_id - b.country_id || a.disease_id - b.disease_id);
}

export function runExample3SourceTrace(
  table: 'coverage' | 'cases',
  id: number,
): CoverageJoinedRow | CaseJoinedRow | undefined {
  if (table === 'coverage') {
    return allCoverageJoined.find((r) => r.record_id === id);
  }
  return allCasesJoined.find((r) => r.case_report_id === id);
}

export function formatCoverage(value: number | null): string {
  if (value === null) return 'Unavailable';
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(2)}%`;
}

export function formatCases(value: number | null): string {
  if (value === null) return 'Unavailable';
  return value.toLocaleString('en-US');
}
