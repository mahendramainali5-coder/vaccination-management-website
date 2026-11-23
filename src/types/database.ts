export interface CountryRow {
  country_id: number;
  country_code: string;
  country_name: string;
}

export interface VaccineIndicatorRow {
  vaccine_id: number;
  indicator_code: string;
  vaccine_name: string;
  dose_series: string;
  vaccine_category: 'ROUTINE' | 'COVID19';
}

export interface DiseaseRow {
  disease_id: number;
  disease_code: string;
  disease_name: string;
}

export interface DataSourceRow {
  source_id: number;
  source_code: string;
  source_name: string;
  organization: string;
  source_url: string;
  notes: string | null;
}

export interface VaccineDiseaseRow {
  vaccine_id: number;
  disease_id: number;
}

export interface VaccinationCoverageRow {
  record_id: number;
  country_id: number;
  vaccine_id: number;
  source_id: number;
  report_year: number;
  coverage_percent: number | null;
  coverage_date: string | null;
}

export interface DiseaseCaseCountRow {
  case_report_id: number;
  country_id: number;
  disease_id: number;
  source_id: number;
  report_year: number;
  reported_cases: number | null;
}

export interface CovidReportingWeeksRow {
  case_report_id: number;
  weeks_reported: number | null;
}

export interface WorkbookValidationSummary {
  sourceWorkbook: string;
  sheetCount: number;
  sheetsLoaded: string[];
  rowCounts: {
    country: number;
    vaccine_indicator: number;
    disease: number;
    data_source: number;
    vaccine_disease: number;
    vaccination_coverage: number;
    disease_case_count: number;
    covid_reporting_weeks: number;
  };
  coverageStats: {
    total: number;
    available: number;
    unavailable: number;
  };
  caseStats: {
    total: number;
    available: number;
    unavailable: number;
    explicitZeros: number;
  };
  foreignKeysValid: boolean;
  duplicateNaturalKeys: number;
}

export interface WorkbookDataset {
  metadata: {
    dataMode: 'workbook';
    workbookFile: string;
    importedAt: string;
    validation: WorkbookValidationSummary;
  };
  tables: {
    country: CountryRow[];
    vaccine_indicator: VaccineIndicatorRow[];
    disease: DiseaseRow[];
    data_source: DataSourceRow[];
    vaccine_disease: VaccineDiseaseRow[];
    vaccination_coverage: VaccinationCoverageRow[];
    disease_case_count: DiseaseCaseCountRow[];
    covid_reporting_weeks: CovidReportingWeeksRow[];
  };
}

export interface CoverageJoinedRow {
  record_id: number;
  country_id: number;
  country_code: string;
  country_name: string;
  vaccine_id: number;
  indicator_code: string;
  vaccine_name: string;
  dose_series: string;
  vaccine_category: 'ROUTINE' | 'COVID19';
  report_year: number;
  coverage_percent: number | null;
  coverage_date: string | null;
  source_id: number;
  source_code: string;
  source_name: string;
  organization: string;
  source_url: string;
}

export interface CaseJoinedRow {
  case_report_id: number;
  country_id: number;
  country_code: string;
  country_name: string;
  disease_id: number;
  disease_code: string;
  disease_name: string;
  linked_indicator_codes: string[];
  report_year: number;
  reported_cases: number | null;
  weeks_reported: number | null;
  source_id: number;
  source_code: string;
  source_name: string;
  organization: string;
  source_url: string;
}

export type AppView = 'dashboard' | 'explorer' | 'design';
export type ExplorerTab = 'coverage' | 'cases';
export type ValueStatusFilter = 'all' | 'available' | 'zero' | 'unavailable';

export interface AppFilterState {
  view: AppView;
  vaccineCode: string; // e.g., 'MCV1', 'DTP3', 'HepB3', 'IPV1', 'COVID19_PRIMARY'
  diseaseCode: string; // e.g., 'MEASLES', 'DIPHTHERIA', 'TETANUS', 'PERTUSSIS', etc.
  countryCodes: string[]; // subset of ['KOR','JPN','CHN','IND','NPL']
  yearFrom: number;
  yearTo: number;
  explorerTab: ExplorerTab;
}
