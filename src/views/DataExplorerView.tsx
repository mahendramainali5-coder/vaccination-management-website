import React, { useMemo, useState } from 'react';
import { ArrowUpDown, Download, ExternalLink, RotateCcw } from 'lucide-react';
import {
  COUNTRY_STYLES,
  filterCaseRows,
  filterCoverageRows,
  formatCases,
  formatCoverage,
  getAllCaseRows,
  getAllCoverageRows,
  getCountries,
  getDiseases,
  getVaccines,
} from '../data/databaseRepository';
import type {
  AppFilterState,
  CaseJoinedRow,
  CoverageJoinedRow,
  ExplorerTab,
  ValueStatusFilter,
} from '../types/database';
import { ALL_COUNTRY_CODES } from '../utils/urlState';
import { downloadCsv } from '../utils/csv';
import { CountryMarkerIcon } from '../components/CountryMarker';

interface DataExplorerViewProps {
  filters: AppFilterState;
  onChangeExplorerTab: (tab: ExplorerTab) => void;
  onChangeVaccine: (vaccineCode: string) => void;
  onChangeDisease: (diseaseCode: string) => void;
  onToggleCountry: (countryCode: string) => void;
  onSelectAllCountries: () => void;
  onChangeYearFrom: (year: number) => void;
  onChangeYearTo: (year: number) => void;
  onResetFilters: () => void;
}

type SortDirection = 'asc' | 'desc';
type CoverageSortKey =
  | 'record_id'
  | 'country_name'
  | 'indicator_code'
  | 'report_year'
  | 'coverage_percent'
  | 'coverage_date'
  | 'source_code';
type CaseSortKey =
  | 'case_report_id'
  | 'country_name'
  | 'disease_name'
  | 'report_year'
  | 'reported_cases'
  | 'weeks_reported'
  | 'source_code';

export const DataExplorerView: React.FC<DataExplorerViewProps> = ({
  filters,
  onChangeExplorerTab,
  onChangeVaccine,
  onChangeDisease,
  onToggleCountry,
  onSelectAllCountries,
  onChangeYearFrom,
  onChangeYearTo,
  onResetFilters,
}) => {
  const [showAllEntities, setShowAllEntities] = useState(false);
  const [valueStatus, setValueStatus] = useState<ValueStatusFilter>('all');
  const [covSort, setCovSort] = useState<{ key: CoverageSortKey; dir: SortDirection }>({
    key: 'report_year',
    dir: 'desc',
  });
  const [caseSort, setCaseSort] = useState<{ key: CaseSortKey; dir: SortDirection }>({
    key: 'report_year',
    dir: 'desc',
  });

  const countries = getCountries();
  const vaccines = getVaccines();
  const diseases = getDiseases();

  const totalCoverageCount = getAllCoverageRows().length;
  const totalCasesCount = getAllCaseRows().length;

  const yearOptions = useMemo(() => {
    const arr: number[] = [];
    for (let y = 2016; y <= 2025; y += 1) arr.push(y);
    return arr;
  }, []);

  // Filtered Coverage rows (matches Dashboard 100% unless user opts into "All indicators")
  const coverageRows = useMemo(() => {
    const base = filterCoverageRows({
      vaccineCode: showAllEntities ? 'ALL' : filters.vaccineCode,
      countryCodes: filters.countryCodes,
      yearFrom: filters.yearFrom,
      yearTo: filters.yearTo,
    });
    const statusFiltered = base.filter((r) => {
      if (valueStatus === 'available') return r.coverage_percent !== null;
      if (valueStatus === 'zero') return r.coverage_percent === 0;
      if (valueStatus === 'unavailable') return r.coverage_percent === null;
      return true;
    });
    return [...statusFiltered].sort((a, b) => {
      const mul = covSort.dir === 'asc' ? 1 : -1;
      const va = a[covSort.key];
      const vb = b[covSort.key];
      if (va === null && vb === null) return 0;
      if (va === null) return 1; // Keep nulls at bottom regardless of direction
      if (vb === null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mul;
      return String(va).localeCompare(String(vb)) * mul;
    });
  }, [
    showAllEntities,
    filters.vaccineCode,
    filters.countryCodes,
    filters.yearFrom,
    filters.yearTo,
    valueStatus,
    covSort,
  ]);

  // Filtered Case rows (matches Dashboard 100% unless user opts into "All diseases")
  const caseRows = useMemo(() => {
    const base = filterCaseRows({
      diseaseCode: showAllEntities ? 'ALL' : filters.diseaseCode,
      countryCodes: filters.countryCodes,
      yearFrom: filters.yearFrom,
      yearTo: filters.yearTo,
    });
    const statusFiltered = base.filter((r) => {
      if (valueStatus === 'available') return r.reported_cases !== null;
      if (valueStatus === 'zero') return r.reported_cases === 0;
      if (valueStatus === 'unavailable') return r.reported_cases === null;
      return true;
    });
    return [...statusFiltered].sort((a, b) => {
      const mul = caseSort.dir === 'asc' ? 1 : -1;
      const va = a[caseSort.key];
      const vb = b[caseSort.key];
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mul;
      return String(va).localeCompare(String(vb)) * mul;
    });
  }, [
    showAllEntities,
    filters.diseaseCode,
    filters.countryCodes,
    filters.yearFrom,
    filters.yearTo,
    valueStatus,
    caseSort,
  ]);

  const toggleCovSort = (key: CoverageSortKey) => {
    setCovSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc',
    }));
  };

  const toggleCaseSort = (key: CaseSortKey) => {
    setCaseSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleDownloadCoverageCsv = () => {
    const headers = [
      'record_id',
      'country_code',
      'country_name',
      'indicator_code',
      'vaccine_name',
      'report_year',
      'coverage_percent (%)',
      'coverage_date',
      'source_code',
      'organization',
      'source_url',
    ];
    const rows = coverageRows.map((r: CoverageJoinedRow) => [
      r.record_id,
      r.country_code,
      r.country_name,
      r.indicator_code,
      r.vaccine_name,
      r.report_year,
      r.coverage_percent, // null exports as blank "", never 0
      r.coverage_date,
      r.source_code,
      r.organization,
      r.source_url,
    ]);
    const tag = showAllEntities ? 'all-vaccines' : filters.vaccineCode;
    downloadCsv(`vaccination_coverage_${tag}_${filters.yearFrom}-${filters.yearTo}.csv`, headers, rows);
  };

  const handleDownloadCasesCsv = () => {
    const headers = [
      'case_report_id',
      'country_code',
      'country_name',
      'disease_code',
      'disease_name',
      'linked_vaccine_indicator',
      'report_year',
      'reported_cases (count)',
      'weeks_reported (count)',
      'source_code',
      'organization',
      'source_url',
    ];
    const rows = caseRows.map((r: CaseJoinedRow) => [
      r.case_report_id,
      r.country_code,
      r.country_name,
      r.disease_code,
      r.disease_name,
      r.linked_indicator_codes.join('; '),
      r.report_year,
      r.reported_cases, // null exports as blank "", explicit 0 exports as "0"
      r.weeks_reported,
      r.source_code,
      r.organization,
      r.source_url,
    ]);
    const tag = showAllEntities ? 'all-diseases' : filters.diseaseCode;
    downloadCsv(`disease_case_count_${tag}_${filters.yearFrom}-${filters.yearTo}.csv`, headers, rows);
  };

  const isCoverageTab = filters.explorerTab === 'coverage';
  const covAvailable = coverageRows.filter((r) => r.coverage_percent !== null).length;
  const covUnavailable = coverageRows.filter((r) => r.coverage_percent === null).length;
  const caseAvailable = caseRows.filter((r) => r.reported_cases !== null).length;
  const caseZeros = caseRows.filter((r) => r.reported_cases === 0).length;
  const caseUnavailable = caseRows.filter((r) => r.reported_cases === null).length;

  return (
    <div>
      {/* Explorer Filter Bar */}
      <section className="filter-bar" aria-label="Data Explorer filters">
        <div className="filter-row">
          <div className="filter-group">
            <span className="filter-label">Table</span>
            <div className="segmented-control" role="tablist" aria-label="Choose table view">
              <button
                type="button"
                role="tab"
                aria-selected={isCoverageTab}
                className={`seg-btn ${isCoverageTab ? 'active-green' : ''}`}
                onClick={() => onChangeExplorerTab('coverage')}
              >
                Coverage ({totalCoverageCount})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={!isCoverageTab}
                className={`seg-btn ${!isCoverageTab ? 'active-green' : ''}`}
                onClick={() => onChangeExplorerTab('cases')}
              >
                Reported Cases ({totalCasesCount})
              </button>
            </div>

            {isCoverageTab ? (
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>Indicator</span>
                <select
                  aria-label="Filter vaccine indicator"
                  className="select-input"
                  value={showAllEntities ? 'ALL' : filters.vaccineCode}
                  onChange={(e) => {
                    if (e.target.value === 'ALL') {
                      setShowAllEntities(true);
                    } else {
                      setShowAllEntities(false);
                      onChangeVaccine(e.target.value);
                    }
                  }}
                >
                  <option value="ALL">All indicators (5)</option>
                  {vaccines.map((v) => (
                    <option key={v.indicator_code} value={v.indicator_code}>
                      {v.indicator_code} — {v.vaccine_name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>Disease</span>
                <select
                  aria-label="Filter disease"
                  className="select-input"
                  value={showAllEntities ? 'ALL' : filters.diseaseCode}
                  onChange={(e) => {
                    if (e.target.value === 'ALL') {
                      setShowAllEntities(true);
                    } else {
                      setShowAllEntities(false);
                      onChangeDisease(e.target.value);
                    }
                  }}
                >
                  <option value="ALL">All diseases (7)</option>
                  {diseases.map((d) => (
                    <option key={d.disease_code} value={d.disease_code}>
                      {d.disease_name} ({d.disease_code})
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="filter-group">
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>Value</span>
              <select
                aria-label="Filter by value availability"
                className="select-input"
                value={valueStatus}
                onChange={(e) => setValueStatus(e.target.value as ValueStatusFilter)}
              >
                <option value="all">All rows</option>
                <option value="available">Has numeric value</option>
                <option value="zero">Explicit zero (0)</option>
                <option value="unavailable">Unavailable (blank)</option>
              </select>
            </label>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>Years</span>
              <select
                aria-label="Explorer start year"
                className="select-input tabular"
                value={filters.yearFrom}
                onChange={(e) => onChangeYearFrom(Number(e.target.value))}
              >
                {yearOptions
                  .filter((y) => y <= filters.yearTo)
                  .map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
              </select>
              <span>–</span>
              <select
                aria-label="Explorer end year"
                className="select-input tabular"
                value={filters.yearTo}
                onChange={(e) => onChangeYearTo(Number(e.target.value))}
              >
                {yearOptions
                  .filter((y) => y >= filters.yearFrom)
                  .map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
              </select>
            </label>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setShowAllEntities(false);
                setValueStatus('all');
                onResetFilters();
              }}
            >
              <RotateCcw size={13} aria-hidden="true" />
              Reset
            </button>
          </div>
        </div>

        <div className="filter-row">
          <div className="filter-group">
            <span className="filter-label">Countries</span>
            {countries.map((c) => {
              const st = COUNTRY_STYLES[c.country_code];
              const selected = filters.countryCodes.includes(c.country_code);
              return (
                <button
                  key={c.country_code}
                  type="button"
                  className={`country-chip ${selected ? 'selected' : ''}`}
                  aria-pressed={selected}
                  style={
                    selected ? { borderColor: st.color, backgroundColor: st.softBg } : undefined
                  }
                  onClick={() => onToggleCountry(c.country_code)}
                >
                  <CountryMarkerIcon shape={st.shape} color={st.color} size={11} />
                  <span>{c.country_name}</span>
                </button>
              );
            })}
            {filters.countryCodes.length < ALL_COUNTRY_CODES.length && (
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '4px 9px', fontSize: 12 }}
                onClick={onSelectAllCountries}
              >
                Select all 5
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Main Data Table Card */}
      <section className="card">
        <div className="table-toolbar">
          <div>
            <h2 className="card-title">
              {isCoverageTab
                ? 'Vaccination Coverage Records (vaccination_coverage)'
                : 'Reported Disease Case Records (disease_case_count)'}
            </h2>
            <p className="card-subtitle tabular">
              {isCoverageTab
                ? `Showing ${coverageRows.length} of ${totalCoverageCount} workbook rows · ${covAvailable} available · ${covUnavailable} unavailable (blank)`
                : `Showing ${caseRows.length} of ${totalCasesCount} workbook rows · ${caseAvailable} available (${caseZeros} explicit zero${caseZeros === 1 ? '' : 's'}) · ${caseUnavailable} unavailable (blank)`}
            </p>
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={isCoverageTab ? coverageRows.length === 0 : caseRows.length === 0}
            onClick={isCoverageTab ? handleDownloadCoverageCsv : handleDownloadCasesCsv}
          >
            <Download size={14} aria-hidden="true" />
            Download filtered CSV ({isCoverageTab ? coverageRows.length : caseRows.length} rows)
          </button>
        </div>

        {isCoverageTab ? (
          coverageRows.length === 0 ? (
            <div className="empty-state">
              <h4>No coverage records match the active filters</h4>
              <p>Adjust your country, indicator, year, or value-status filters to inspect records.</p>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>
                      <button type="button" className="sort-btn" onClick={() => toggleCovSort('record_id')}>
                        ID <ArrowUpDown size={12} aria-hidden="true" />
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-btn" onClick={() => toggleCovSort('country_name')}>
                        Country <ArrowUpDown size={12} aria-hidden="true" />
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-btn" onClick={() => toggleCovSort('indicator_code')}>
                        Indicator <ArrowUpDown size={12} aria-hidden="true" />
                      </button>
                    </th>
                    <th className="num-col">
                      <button type="button" className="sort-btn" onClick={() => toggleCovSort('report_year')}>
                        Year <ArrowUpDown size={12} aria-hidden="true" />
                      </button>
                    </th>
                    <th className="num-col">
                      <button type="button" className="sort-btn" onClick={() => toggleCovSort('coverage_percent')}>
                        Coverage (%) <ArrowUpDown size={12} aria-hidden="true" />
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-btn" onClick={() => toggleCovSort('coverage_date')}>
                        Snapshot Date <ArrowUpDown size={12} aria-hidden="true" />
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-btn" onClick={() => toggleCovSort('source_code')}>
                        Source <ArrowUpDown size={12} aria-hidden="true" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {coverageRows.map((r) => {
                    const st = COUNTRY_STYLES[r.country_code];
                    return (
                      <tr key={r.record_id}>
                        <td className="mono tabular" style={{ color: 'var(--text-muted)' }}>
                          {r.record_id}
                        </td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                            <CountryMarkerIcon shape={st.shape} color={st.color} size={10} />
                            {r.country_name}
                            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                              ({r.country_code})
                            </span>
                          </span>
                        </td>
                        <td>
                          <span className="mono" style={{ fontWeight: 600 }}>
                            {r.indicator_code}
                          </span>{' '}
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                            · {r.vaccine_name}
                          </span>
                        </td>
                        <td className="num-col tabular">{r.report_year}</td>
                        <td className="num-col tabular">
                          {r.coverage_percent === null ? (
                            <span className="badge-missing">Unavailable</span>
                          ) : (
                            <strong>{formatCoverage(r.coverage_percent)}</strong>
                          )}
                        </td>
                        <td className="tabular" style={{ color: 'var(--text-secondary)' }}>
                          {r.coverage_date ?? <span className="badge-missing">—</span>}
                        </td>
                        <td>
                          <a
                            href={r.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="source-link"
                            title={r.source_name}
                          >
                            {r.organization} ({r.source_code})
                            <ExternalLink size={11} aria-hidden="true" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : caseRows.length === 0 ? (
          <div className="empty-state">
            <h4>No reported case records match the active filters</h4>
            <p>Adjust your country, disease, year, or value-status filters to inspect records.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <button type="button" className="sort-btn" onClick={() => toggleCaseSort('case_report_id')}>
                      ID <ArrowUpDown size={12} aria-hidden="true" />
                    </button>
                  </th>
                  <th>
                    <button type="button" className="sort-btn" onClick={() => toggleCaseSort('country_name')}>
                      Country <ArrowUpDown size={12} aria-hidden="true" />
                    </button>
                  </th>
                  <th>
                    <button type="button" className="sort-btn" onClick={() => toggleCaseSort('disease_name')}>
                      Disease <ArrowUpDown size={12} aria-hidden="true" />
                    </button>
                  </th>
                  <th>Linked Vaccine</th>
                  <th className="num-col">
                    <button type="button" className="sort-btn" onClick={() => toggleCaseSort('report_year')}>
                      Year <ArrowUpDown size={12} aria-hidden="true" />
                    </button>
                  </th>
                  <th className="num-col">
                    <button type="button" className="sort-btn" onClick={() => toggleCaseSort('reported_cases')}>
                      Reported Cases (count) <ArrowUpDown size={12} aria-hidden="true" />
                    </button>
                  </th>
                  <th>
                    <button type="button" className="sort-btn" onClick={() => toggleCaseSort('weeks_reported')}>
                      Reporting Weeks <ArrowUpDown size={12} aria-hidden="true" />
                    </button>
                  </th>
                  <th>
                    <button type="button" className="sort-btn" onClick={() => toggleCaseSort('source_code')}>
                      Source <ArrowUpDown size={12} aria-hidden="true" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {caseRows.map((r) => {
                  const st = COUNTRY_STYLES[r.country_code];
                  return (
                    <tr key={r.case_report_id}>
                      <td className="mono tabular" style={{ color: 'var(--text-muted)' }}>
                        {r.case_report_id}
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                          <CountryMarkerIcon shape={st.shape} color={st.color} size={10} />
                          {r.country_name}
                          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                            ({r.country_code})
                          </span>
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{r.disease_name}</td>
                      <td className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {r.linked_indicator_codes.join(', ')}
                      </td>
                      <td className="num-col tabular">{r.report_year}</td>
                      <td className="num-col tabular">
                        {r.reported_cases === null ? (
                          <span className="badge-missing">Unavailable</span>
                        ) : r.reported_cases === 0 ? (
                          <span className="badge-zero">
                            0 <span className="badge-zero-tag">Reported zero</span>
                          </span>
                        ) : (
                          <strong>{formatCases(r.reported_cases)}</strong>
                        )}
                      </td>
                      <td className="tabular">
                        {r.disease_code !== 'COVID19' ? (
                          <span className="badge-missing">—</span>
                        ) : r.weeks_reported === null ? (
                          <span className="badge-missing">Unavailable</span>
                        ) : r.weeks_reported < 52 ? (
                          <span className="badge-partial">{r.weeks_reported} wks (partial)</span>
                        ) : (
                          <span className="badge-full-weeks">{r.weeks_reported} wks</span>
                        )}
                      </td>
                      <td>
                        <a
                          href={r.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="source-link"
                          title={r.source_name}
                        >
                          {r.organization} ({r.source_code})
                          <ExternalLink size={11} aria-hidden="true" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
