#!/usr/bin/env node
/**
 * Repeatable Workbook Import & Integrity Validation Script
 *
 * Reads the normalized 3NF workbook:
 *   ../Vaccination_Project_Final_Fixed/Data/Vaccination_Final_Data_3NF.xlsx
 * (or a custom path passed via --source <path>)
 *
 * Validates:
 *   - All 7 core 3NF sheets + supplementary covid_reporting_weeks sheet
 *   - Primary key uniqueness on every table
 *   - Foreign key integrity across vaccine_disease, vaccination_coverage,
 *     disease_case_count, and covid_reporting_weeks
 *   - Natural grain uniqueness:
 *       (country_id, vaccine_id, report_year) on vaccination_coverage
 *       (country_id, disease_id, report_year) on disease_case_count
 *   - Domain bounds: coverage_percent in [0, 100] or null; reported_cases >= 0 integer or null
 *   - Explicit distinction between blank/missing (null) and confirmed zero (0)
 *
 * Outputs bundled offline JSON:
 *   src/data/workbookData.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const defaultWorkbookPath = path.resolve(
  projectRoot,
  '..',
  'Vaccination_Project_Final_Fixed',
  'Data',
  'Vaccination_Final_Data_3NF.xlsx',
);

const args = process.argv.slice(2);
const sourceIdx = args.indexOf('--source');
const workbookPath =
  sourceIdx !== -1 && args[sourceIdx + 1]
    ? path.resolve(process.cwd(), args[sourceIdx + 1])
    : defaultWorkbookPath;

if (!fs.existsSync(workbookPath)) {
  console.error(`ERROR: Workbook not found at: ${workbookPath}`);
  process.exit(1);
}

const wb = XLSX.readFile(workbookPath, { cellDates: false });

const REQUIRED_SHEETS = [
  'country',
  'vaccine_indicator',
  'disease',
  'data_source',
  'vaccine_disease',
  'vaccination_coverage',
  'disease_case_count',
];

for (const name of REQUIRED_SHEETS) {
  if (!wb.SheetNames.includes(name)) {
    console.error(`ERROR: Required sheet "${name}" missing from workbook.`);
    process.exit(1);
  }
}

function readSheet(name) {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  // defval: null preserves empty cells explicitly as null (never coerced to 0 or "")
  return XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
}

function toNullableNumber(val, fieldName, rowDesc) {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  if (!Number.isFinite(num)) {
    throw new Error(`Invalid numeric value "${val}" for ${fieldName} (${rowDesc})`);
  }
  return num;
}

function toRequiredInt(val, fieldName, rowDesc) {
  const num = toNullableNumber(val, fieldName, rowDesc);
  if (num === null || !Number.isInteger(num)) {
    throw new Error(`Expected integer for ${fieldName}, got "${val}" (${rowDesc})`);
  }
  return num;
}

function toNullableString(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  return s === '' ? null : s;
}

function formatExcelDate(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    const parsed = XLSX.SSF.parse_date_code(val);
    if (!parsed) return String(val);
    const yyyy = String(parsed.y).padStart(4, '0');
    const mm = String(parsed.m).padStart(2, '0');
    const dd = String(parsed.d).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  const s = String(val).trim();
  return s === '' ? null : s;
}

// 1. Parse all tables
const countries = readSheet('country').map((r, i) => ({
  country_id: toRequiredInt(r.country_id, 'country_id', `country#${i + 2}`),
  country_code: String(r.country_code).trim(),
  country_name: String(r.country_name).trim(),
}));

const vaccineIndicators = readSheet('vaccine_indicator').map((r, i) => ({
  vaccine_id: toRequiredInt(r.vaccine_id, 'vaccine_id', `vaccine_indicator#${i + 2}`),
  indicator_code: String(r.indicator_code).trim(),
  vaccine_name: String(r.vaccine_name).trim(),
  dose_series: String(r.dose_series).trim(),
  vaccine_category: String(r.vaccine_category).trim(),
}));

const diseases = readSheet('disease').map((r, i) => ({
  disease_id: toRequiredInt(r.disease_id, 'disease_id', `disease#${i + 2}`),
  disease_code: String(r.disease_code).trim(),
  disease_name: String(r.disease_name).trim(),
}));

const dataSources = readSheet('data_source').map((r, i) => ({
  source_id: toRequiredInt(r.source_id, 'source_id', `data_source#${i + 2}`),
  source_code: String(r.source_code).trim(),
  source_name: String(r.source_name).trim(),
  organization: String(r.organization).trim(),
  source_url: String(r.source_url).trim(),
  notes: toNullableString(r.notes),
}));

const vaccineDiseases = readSheet('vaccine_disease').map((r, i) => ({
  vaccine_id: toRequiredInt(r.vaccine_id, 'vaccine_id', `vaccine_disease#${i + 2}`),
  disease_id: toRequiredInt(r.disease_id, 'disease_id', `vaccine_disease#${i + 2}`),
}));

const vaccinationCoverage = readSheet('vaccination_coverage').map((r, i) => ({
  record_id: toRequiredInt(r.record_id, 'record_id', `vaccination_coverage#${i + 2}`),
  country_id: toRequiredInt(r.country_id, 'country_id', `vaccination_coverage#${i + 2}`),
  vaccine_id: toRequiredInt(r.vaccine_id, 'vaccine_id', `vaccination_coverage#${i + 2}`),
  source_id: toRequiredInt(r.source_id, 'source_id', `vaccination_coverage#${i + 2}`),
  report_year: toRequiredInt(r.report_year, 'report_year', `vaccination_coverage#${i + 2}`),
  coverage_percent: toNullableNumber(r.coverage_percent, 'coverage_percent', `vaccination_coverage#${i + 2}`),
  coverage_date: formatExcelDate(r.coverage_date),
}));

const diseaseCaseCount = readSheet('disease_case_count').map((r, i) => {
  const cases = toNullableNumber(r.reported_cases, 'reported_cases', `disease_case_count#${i + 2}`);
  if (cases !== null && (!Number.isInteger(cases) || cases < 0)) {
    throw new Error(`Invalid reported_cases "${cases}" at disease_case_count#${i + 2}`);
  }
  return {
    case_report_id: toRequiredInt(r.case_report_id, 'case_report_id', `disease_case_count#${i + 2}`),
    country_id: toRequiredInt(r.country_id, 'country_id', `disease_case_count#${i + 2}`),
    disease_id: toRequiredInt(r.disease_id, 'disease_id', `disease_case_count#${i + 2}`),
    source_id: toRequiredInt(r.source_id, 'source_id', `disease_case_count#${i + 2}`),
    report_year: toRequiredInt(r.report_year, 'report_year', `disease_case_count#${i + 2}`),
    reported_cases: cases,
  };
});

const hasWeeksSheet = wb.SheetNames.includes('covid_reporting_weeks');
const covidReportingWeeks = hasWeeksSheet
  ? readSheet('covid_reporting_weeks').map((r, i) => {
      const weeks = toNullableNumber(r.weeks_reported, 'weeks_reported', `covid_reporting_weeks#${i + 2}`);
      if (weeks !== null && (!Number.isInteger(weeks) || weeks < 0 || weeks > 53)) {
        throw new Error(`Invalid weeks_reported "${weeks}" at covid_reporting_weeks#${i + 2}`);
      }
      return {
        case_report_id: toRequiredInt(r.case_report_id, 'case_report_id', `covid_reporting_weeks#${i + 2}`),
        weeks_reported: weeks,
      };
    })
  : [];

// 2. Integrity Validation
const errors = [];

function checkUnique(arr, keyFn, label) {
  const seen = new Set();
  for (const item of arr) {
    const k = keyFn(item);
    if (seen.has(k)) {
      errors.push(`Duplicate ${label}: ${k}`);
    }
    seen.add(k);
  }
  return seen;
}

const countryIds = checkUnique(countries, (x) => x.country_id, 'country.country_id');
checkUnique(countries, (x) => x.country_code, 'country.country_code');
const vaccineIds = checkUnique(vaccineIndicators, (x) => x.vaccine_id, 'vaccine_indicator.vaccine_id');
checkUnique(vaccineIndicators, (x) => x.indicator_code, 'vaccine_indicator.indicator_code');
const diseaseIds = checkUnique(diseases, (x) => x.disease_id, 'disease.disease_id');
checkUnique(diseases, (x) => x.disease_code, 'disease.disease_code');
const sourceIds = checkUnique(dataSources, (x) => x.source_id, 'data_source.source_id');
checkUnique(dataSources, (x) => x.source_code, 'data_source.source_code');

checkUnique(vaccineDiseases, (x) => `${x.vaccine_id}-${x.disease_id}`, 'vaccine_disease PK');
for (const vd of vaccineDiseases) {
  if (!vaccineIds.has(vd.vaccine_id)) errors.push(`FK violation vaccine_disease.vaccine_id=${vd.vaccine_id}`);
  if (!diseaseIds.has(vd.disease_id)) errors.push(`FK violation vaccine_disease.disease_id=${vd.disease_id}`);
}

checkUnique(vaccinationCoverage, (x) => x.record_id, 'vaccination_coverage.record_id');
checkUnique(
  vaccinationCoverage,
  (x) => `${x.country_id}-${x.vaccine_id}-${x.report_year}`,
  'vaccination_coverage (country_id, vaccine_id, report_year)',
);
for (const vc of vaccinationCoverage) {
  if (!countryIds.has(vc.country_id)) errors.push(`FK violation vaccination_coverage.country_id=${vc.country_id}`);
  if (!vaccineIds.has(vc.vaccine_id)) errors.push(`FK violation vaccination_coverage.vaccine_id=${vc.vaccine_id}`);
  if (!sourceIds.has(vc.source_id)) errors.push(`FK violation vaccination_coverage.source_id=${vc.source_id}`);
  if (vc.coverage_percent !== null && (vc.coverage_percent < 0 || vc.coverage_percent > 100)) {
    errors.push(`Range violation vaccination_coverage.record_id=${vc.record_id}: ${vc.coverage_percent}`);
  }
}

const caseReportIds = checkUnique(diseaseCaseCount, (x) => x.case_report_id, 'disease_case_count.case_report_id');
checkUnique(
  diseaseCaseCount,
  (x) => `${x.country_id}-${x.disease_id}-${x.report_year}`,
  'disease_case_count (country_id, disease_id, report_year)',
);
for (const dc of diseaseCaseCount) {
  if (!countryIds.has(dc.country_id)) errors.push(`FK violation disease_case_count.country_id=${dc.country_id}`);
  if (!diseaseIds.has(dc.disease_id)) errors.push(`FK violation disease_case_count.disease_id=${dc.disease_id}`);
  if (!sourceIds.has(dc.source_id)) errors.push(`FK violation disease_case_count.source_id=${dc.source_id}`);
}

checkUnique(covidReportingWeeks, (x) => x.case_report_id, 'covid_reporting_weeks.case_report_id');
for (const wk of covidReportingWeeks) {
  if (!caseReportIds.has(wk.case_report_id)) {
    errors.push(`FK violation covid_reporting_weeks.case_report_id=${wk.case_report_id}`);
  }
}

if (errors.length > 0) {
  console.error('Workbook validation FAILED:');
  for (const e of errors) console.error('  -', e);
  process.exit(1);
}

const validation = {
  sourceWorkbook: path.basename(workbookPath),
  sheetCount: wb.SheetNames.length,
  sheetsLoaded: wb.SheetNames,
  rowCounts: {
    country: countries.length,
    vaccine_indicator: vaccineIndicators.length,
    disease: diseases.length,
    data_source: dataSources.length,
    vaccine_disease: vaccineDiseases.length,
    vaccination_coverage: vaccinationCoverage.length,
    disease_case_count: diseaseCaseCount.length,
    covid_reporting_weeks: covidReportingWeeks.length,
  },
  coverageStats: {
    total: vaccinationCoverage.length,
    available: vaccinationCoverage.filter((r) => r.coverage_percent !== null).length,
    unavailable: vaccinationCoverage.filter((r) => r.coverage_percent === null).length,
  },
  caseStats: {
    total: diseaseCaseCount.length,
    available: diseaseCaseCount.filter((r) => r.reported_cases !== null).length,
    unavailable: diseaseCaseCount.filter((r) => r.reported_cases === null).length,
    explicitZeros: diseaseCaseCount.filter((r) => r.reported_cases === 0).length,
  },
  foreignKeysValid: true,
  duplicateNaturalKeys: 0,
};

const output = {
  metadata: {
    dataMode: 'workbook',
    workbookFile: path.basename(workbookPath),
    importedAt: new Date().toISOString(),
    validation,
  },
  tables: {
    country: countries,
    vaccine_indicator: vaccineIndicators,
    disease: diseases,
    data_source: dataSources,
    vaccine_disease: vaccineDiseases,
    vaccination_coverage: vaccinationCoverage,
    disease_case_count: diseaseCaseCount,
    covid_reporting_weeks: covidReportingWeeks,
  },
};

const outPath = path.join(projectRoot, 'src', 'data', 'workbookData.json');
fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n', 'utf-8');

console.log('Workbook import & validation PASSED:');
console.log(`  Source: ${workbookPath}`);
console.log(`  Output: ${outPath}`);
console.log(`  Coverage rows: ${validation.coverageStats.total} (${validation.coverageStats.available} available, ${validation.coverageStats.unavailable} unavailable)`);
console.log(`  Case rows:     ${validation.caseStats.total} (${validation.caseStats.available} available, ${validation.caseStats.explicitZeros} explicit zeros, ${validation.caseStats.unavailable} unavailable)`);
console.log(`  COVID weeks:   ${validation.rowCounts.covid_reporting_weeks} rows`);
console.log('  FK & unique key checks: 0 errors');
