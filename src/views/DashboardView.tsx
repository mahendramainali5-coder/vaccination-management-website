import React, { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ExternalLink,
  Info,
  RotateCcw,
  Share2,
  Check,
} from 'lucide-react';
import {
  COUNTRY_STYLES,
  filterCaseRows,
  filterCoverageRows,
  formatCases,
  formatCoverage,
  getCountries,
  getDiseaseByCode,
  getDiseasesForVaccineCode,
  getLatestAvailableCoverageYear,
  getUniqueSourcesFromRows,
  getVaccineByCode,
  getVaccines,
  getYearComparisonForIndicator,
} from '../data/databaseRepository';
import {
  ALL_COUNTRY_CODES,
  getYearBoundsForVaccine,
} from '../utils/urlState';
import type {
  AppFilterState,
  CaseJoinedRow,
  CoverageJoinedRow,
} from '../types/database';
import { CountryMarkerIcon, renderCountryChartDot } from '../components/CountryMarker';

interface DashboardViewProps {
  filters: AppFilterState;
  onChangeVaccine: (vaccineCode: string) => void;
  onChangeDisease: (diseaseCode: string) => void;
  onToggleCountry: (countryCode: string) => void;
  onSelectAllCountries: () => void;
  onChangeYearFrom: (year: number) => void;
  onChangeYearTo: (year: number) => void;
  onResetFilters: () => void;
  onJumpToExplorer: (tab: 'coverage' | 'cases') => void;
}

interface CoverageChartPoint {
  year: number;
  [countryCode: string]: number | null | undefined;
}

interface CasesChartPoint {
  year: number;
  [countryCode: string]: number | null | undefined;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  filters,
  onChangeVaccine,
  onChangeDisease,
  onToggleCountry,
  onSelectAllCountries,
  onChangeYearFrom,
  onChangeYearTo,
  onResetFilters,
  onJumpToExplorer,
}) => {
  const [coverageFullScale, setCoverageFullScale] = useState(false);
  const [comparisonYearOverride, setComparisonYearOverride] = useState<number | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const countries = getCountries();
  const vaccines = getVaccines();
  const activeVaccine = getVaccineByCode(filters.vaccineCode)!;
  const activeDisease = getDiseaseByCode(filters.diseaseCode)!;
  const vaccineDiseases = getDiseasesForVaccineCode(filters.vaccineCode);
  const bounds = getYearBoundsForVaccine(filters.vaccineCode);

  const availableYears = useMemo(() => {
    const arr: number[] = [];
    for (let y = bounds.min; y <= bounds.max; y += 1) arr.push(y);
    return arr;
  }, [bounds.min, bounds.max]);

  const filteredCoverage = useMemo(
    () =>
      filterCoverageRows({
        vaccineCode: filters.vaccineCode,
        countryCodes: filters.countryCodes,
        yearFrom: filters.yearFrom,
        yearTo: filters.yearTo,
      }),
    [filters.vaccineCode, filters.countryCodes, filters.yearFrom, filters.yearTo],
  );

  const filteredCases = useMemo(
    () =>
      filterCaseRows({
        diseaseCode: filters.diseaseCode,
        countryCodes: filters.countryCodes,
        yearFrom: filters.yearFrom,
        yearTo: filters.yearTo,
      }),
    [filters.diseaseCode, filters.countryCodes, filters.yearFrom, filters.yearTo],
  );

  // Lookup maps for rich tooltips (snapshot date, reporting weeks, source)
  const coverageLookup = useMemo(() => {
    const m = new Map<string, CoverageJoinedRow>();
    for (const r of filteredCoverage) {
      m.set(`${r.report_year}:${r.country_code}`, r);
    }
    return m;
  }, [filteredCoverage]);

  const casesLookup = useMemo(() => {
    const m = new Map<string, CaseJoinedRow>();
    for (const r of filteredCases) {
      m.set(`${r.report_year}:${r.country_code}`, r);
    }
    return m;
  }, [filteredCases]);

  // Build chart series arrays across every year in [yearFrom, yearTo]
  const yearsInWindow = useMemo(() => {
    const yrs: number[] = [];
    for (let y = filters.yearFrom; y <= filters.yearTo; y += 1) yrs.push(y);
    return yrs;
  }, [filters.yearFrom, filters.yearTo]);

  const coverageChartData: CoverageChartPoint[] = useMemo(() => {
    return yearsInWindow.map((year) => {
      const pt: CoverageChartPoint = { year };
      for (const code of filters.countryCodes) {
        const rec = coverageLookup.get(`${year}:${code}`);
        pt[code] = rec ? rec.coverage_percent : null;
      }
      return pt;
    });
  }, [yearsInWindow, filters.countryCodes, coverageLookup]);

  const casesChartData: CasesChartPoint[] = useMemo(() => {
    return yearsInWindow.map((year) => {
      const pt: CasesChartPoint = { year };
      for (const code of filters.countryCodes) {
        const rec = casesLookup.get(`${year}:${code}`);
        pt[code] = rec ? rec.reported_cases : null;
      }
      return pt;
    });
  }, [yearsInWindow, filters.countryCodes, casesLookup]);

  const coverageYDomain = useMemo((): [number, number] => {
    if (coverageFullScale) return [0, 100];
    const nums = filteredCoverage
      .map((r) => r.coverage_percent)
      .filter((v): v is number => v !== null);
    if (nums.length === 0) return [0, 100];
    const minVal = Math.min(...nums);
    const floor = Math.max(0, Math.floor((minVal - 5) / 10) * 10);
    return [floor, 100];
  }, [coverageFullScale, filteredCoverage]);

  // Latest-year comparison: defaults to filter's yearTo, allows switching to latest snapshot with data
  const effectiveComparisonYear = useMemo(() => {
    if (
      comparisonYearOverride !== null &&
      comparisonYearOverride >= filters.yearFrom &&
      comparisonYearOverride <= filters.yearTo
    ) {
      return comparisonYearOverride;
    }
    return filters.yearTo;
  }, [comparisonYearOverride, filters.yearFrom, filters.yearTo]);

  const latestAvailableCoverageYear = useMemo(
    () =>
      getLatestAvailableCoverageYear(
        filters.vaccineCode,
        filters.countryCodes,
        filters.yearFrom,
        filters.yearTo,
      ),
    [filters.vaccineCode, filters.countryCodes, filters.yearFrom, filters.yearTo],
  );

  const comparisonItems = useMemo(
    () =>
      getYearComparisonForIndicator(
        filters.vaccineCode,
        filters.countryCodes,
        effectiveComparisonYear,
      ),
    [filters.vaccineCode, filters.countryCodes, effectiveComparisonYear],
  );

  const activeSources = useMemo(
    () => getUniqueSourcesFromRows([...filteredCoverage, ...filteredCases]),
    [filteredCoverage, filteredCases],
  );

  const coverageMissingCount = filteredCoverage.filter((r) => r.coverage_percent === null).length;
  const casesAvailableCount = filteredCases.filter((r) => r.reported_cases !== null).length;
  const casesMissingCount = filteredCases.filter((r) => r.reported_cases === null).length;
  const casesZeroCount = filteredCases.filter((r) => r.reported_cases === 0).length;

  const partialCovidWeeks = useMemo(
    () =>
      filteredCases.filter(
        (r) =>
          r.disease_code === 'COVID19' &&
          r.weeks_reported !== null &&
          r.weeks_reported < 52,
      ),
    [filteredCases],
  );

  const covidSnapshots = useMemo(
    () =>
      filteredCoverage.filter(
        (r) => r.indicator_code === 'COVID19_PRIMARY' && r.coverage_date !== null,
      ),
    [filteredCoverage],
  );

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Fallback if clipboard API is unavailable
    }
  };

  const hasSelectedCountries = filters.countryCodes.length > 0;

  return (
    <div>
      {/* Filter Controls */}
      <section className="filter-bar" aria-label="Dashboard filters">
        <div className="filter-row">
          <div className="filter-group">
            <span className="filter-label">Vaccine</span>
            <div className="segmented-control" role="group" aria-label="Select vaccine indicator">
              {vaccines.map((v) => {
                const isActive = v.indicator_code === filters.vaccineCode;
                const shortLabel =
                  v.indicator_code === 'COVID19_PRIMARY'
                    ? 'COVID-19'
                    : `${v.vaccine_name.split(' ')[0]} (${v.indicator_code})`;
                return (
                  <button
                    key={v.indicator_code}
                    type="button"
                    className={`seg-btn ${isActive ? 'active' : ''}`}
                    aria-pressed={isActive}
                    onClick={() => {
                      setComparisonYearOverride(null);
                      onChangeVaccine(v.indicator_code);
                    }}
                  >
                    {shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="filter-group">
            <span className="filter-label">Years</span>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>From</span>
              <select
                aria-label="Start year"
                className="select-input tabular"
                value={filters.yearFrom}
                onChange={(e) => {
                  setComparisonYearOverride(null);
                  onChangeYearFrom(Number(e.target.value));
                }}
              >
                {availableYears
                  .filter((y) => y <= filters.yearTo)
                  .map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
              </select>
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>To</span>
              <select
                aria-label="End year"
                className="select-input tabular"
                value={filters.yearTo}
                onChange={(e) => {
                  setComparisonYearOverride(null);
                  onChangeYearTo(Number(e.target.value));
                }}
              >
                {availableYears
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
                setComparisonYearOverride(null);
                setCoverageFullScale(false);
                onResetFilters();
              }}
              title="Reset to Measles (MCV1), all five countries, 2016–2025"
            >
              <RotateCcw size={13} aria-hidden="true" />
              Reset
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCopyShareLink}
              title="Copy shareable link with current filters"
            >
              {copiedLink ? <Check size={13} aria-hidden="true" /> : <Share2 size={13} aria-hidden="true" />}
              {copiedLink ? 'Copied' : 'Share'}
            </button>
          </div>
        </div>

        <div className="filter-row">
          <div className="filter-group" role="group" aria-label="Toggle countries">
            <span className="filter-label">Countries</span>
            {countries.map((c) => {
              const style = COUNTRY_STYLES[c.country_code];
              const selected = filters.countryCodes.includes(c.country_code);
              return (
                <button
                  key={c.country_code}
                  type="button"
                  className={`country-chip ${selected ? 'selected' : ''}`}
                  aria-pressed={selected}
                  style={
                    selected
                      ? { borderColor: style.color, backgroundColor: style.softBg }
                      : undefined
                  }
                  onClick={() => onToggleCountry(c.country_code)}
                >
                  <CountryMarkerIcon shape={style.shape} color={style.color} size={11} />
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

          {filters.vaccineCode === 'DTP3' && (
            <div className="filter-group" role="group" aria-label="Select DTP3 prevented disease">
              <span className="filter-label">DTP3 Disease</span>
              <div className="segmented-control">
                {vaccineDiseases.map((d) => {
                  const isActive = d.disease_code === filters.diseaseCode;
                  return (
                    <button
                      key={d.disease_code}
                      type="button"
                      className={`seg-btn ${isActive ? 'active-green' : ''}`}
                      aria-pressed={isActive}
                      onClick={() => onChangeDisease(d.disease_code)}
                    >
                      {d.disease_name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Main Content Grid */}
      {!hasSelectedCountries ? (
        <div className="empty-state">
          <h4>No countries selected</h4>
          <p>
            Select at least one country above to display vaccination coverage trends and reported
            disease case counts.
          </p>
          <div style={{ marginTop: 12 }}>
            <button type="button" className="btn-primary" onClick={onSelectAllCountries}>
              Show all five countries
            </button>
          </div>
        </div>
      ) : (
        <div className="dashboard-grid">
          {/* Primary Charts Column */}
          <div className="charts-column">
            {/* Chart 1: Vaccination Coverage (%) */}
            <section className="card" aria-labelledby="coverage-chart-heading">
              <div className="card-header">
                <div>
                  <h2 id="coverage-chart-heading" className="card-title">
                    {activeVaccine.vaccine_name} Vaccination Coverage ({activeVaccine.indicator_code})
                    <span className="unit-tag">Unit: % of target population</span>
                  </h2>
                  <p className="card-subtitle">
                    {activeVaccine.dose_series} · {filters.yearFrom}–{filters.yearTo} · Missing
                    observations appear as gaps
                  </p>
                </div>
                <div className="segmented-control" role="group" aria-label="Coverage Y-axis scale">
                  <button
                    type="button"
                    className={`seg-btn ${!coverageFullScale ? 'active' : ''}`}
                    onClick={() => setCoverageFullScale(false)}
                    style={{ fontSize: 12, padding: '4px 9px' }}
                  >
                    Zoomed Y
                  </button>
                  <button
                    type="button"
                    className={`seg-btn ${coverageFullScale ? 'active' : ''}`}
                    onClick={() => setCoverageFullScale(true)}
                    style={{ fontSize: 12, padding: '4px 9px' }}
                  >
                    0–100%
                  </button>
                </div>
              </div>

              <div className="chart-legend" aria-label="Country legend">
                {filters.countryCodes.map((code) => {
                  const st = COUNTRY_STYLES[code];
                  return (
                    <span key={code} className="legend-item">
                      <CountryMarkerIcon shape={st.shape} color={st.color} size={12} />
                      <span>
                        {st.name} ({code})
                      </span>
                    </span>
                  );
                })}
              </div>

              <div className="chart-box">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={coverageChartData}
                    margin={{ top: 10, right: 18, left: 4, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf0" />
                    <XAxis
                      dataKey="year"
                      tick={{ fontSize: 12, fill: '#425466' }}
                      tickLine={{ stroke: '#cbd5e1' }}
                      axisLine={{ stroke: '#cbd5e1' }}
                    />
                    <YAxis
                      domain={coverageYDomain}
                      tickFormatter={(v: number) => `${v}%`}
                      tick={{ fontSize: 12, fill: '#425466' }}
                      tickLine={{ stroke: '#cbd5e1' }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      width={48}
                    />
                    <Tooltip
                      content={({ active, label }) => {
                        if (!active || label === undefined) return null;
                        const yr = Number(label);
                        return (
                          <div className="chart-tooltip">
                            <div className="tooltip-year">
                              {activeVaccine.indicator_code} Coverage — {yr}
                            </div>
                            {filters.countryCodes.map((code) => {
                              const st = COUNTRY_STYLES[code];
                              const rec = coverageLookup.get(`${yr}:${code}`);
                              const val = rec ? rec.coverage_percent : null;
                              return (
                                <div key={code}>
                                  <div className="tooltip-row">
                                    <span className="tooltip-country">
                                      <CountryMarkerIcon
                                        shape={st.shape}
                                        color={st.color}
                                        size={10}
                                      />
                                      {st.name}
                                    </span>
                                    <span className={`tooltip-val ${val === null ? 'missing' : ''}`}>
                                      {formatCoverage(val)}
                                    </span>
                                  </div>
                                  {rec?.coverage_date && (
                                    <div className="tooltip-meta">
                                      Snapshot: {rec.coverage_date} ({rec.organization})
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      }}
                    />
                    {filters.countryCodes.map((code) => {
                      const st = COUNTRY_STYLES[code];
                      return (
                        <Line
                          key={code}
                          type="monotone"
                          dataKey={code}
                          name={st.name}
                          stroke={st.color}
                          strokeWidth={2.2}
                          connectNulls={false}
                          isAnimationActive={false}
                          dot={(props) => {
                            const el = renderCountryChartDot({
                              cx: props.cx,
                              cy: props.cy,
                              value: props.value,
                              shape: st.shape,
                              color: st.color,
                            });
                            return el ? React.cloneElement(el, { key: `${code}-${props.index}` }) : <g key={`${code}-${props.index}`} />;
                          }}
                          activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2, fill: st.color }}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Chart 2: Reported Disease Cases (Separate Chart & Unit) */}
            <section className="card" aria-labelledby="cases-chart-heading">
              <div className="card-header">
                <div>
                  <h2 id="cases-chart-heading" className="card-title">
                    Reported {activeDisease.disease_name} Cases
                    <span className="unit-tag">Unit: Annual case count</span>
                  </h2>
                  <p className="card-subtitle">
                    Surveillance count ({filters.yearFrom}–{filters.yearTo}) · Explicit 0 plotted on
                    baseline; unavailable years left blank
                  </p>
                </div>

                {filters.vaccineCode === 'DTP3' && (
                  <div className="segmented-control" role="group" aria-label="Switch DTP3 disease series">
                    {vaccineDiseases.map((d) => (
                      <button
                        key={d.disease_code}
                        type="button"
                        className={`seg-btn ${d.disease_code === filters.diseaseCode ? 'active-green' : ''}`}
                        style={{ fontSize: 12, padding: '4px 9px' }}
                        onClick={() => onChangeDisease(d.disease_code)}
                      >
                        {d.disease_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {casesAvailableCount === 0 ? (
                <div className="empty-state">
                  <Info size={20} color="#64748b" aria-hidden="true" />
                  <h4>No reported {activeDisease.disease_name} case figures available</h4>
                  <p>
                    {filters.diseaseCode === 'HEPB'
                      ? 'No comparable Hepatitis B case series was verified across the five study countries in the source workbook. All records remain blank (Unavailable) rather than being filled with zeros.'
                      : 'All records for the selected countries and year range are blank (Unavailable) in the source workbook.'}
                  </p>
                  <div style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => onJumpToExplorer('cases')}
                    >
                      Inspect blank records in Data Explorer
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="chart-legend" aria-label="Cases chart legend">
                    {filters.countryCodes.map((code) => {
                      const st = COUNTRY_STYLES[code];
                      return (
                        <span key={code} className="legend-item">
                          <CountryMarkerIcon shape={st.shape} color={st.color} size={12} />
                          <span>
                            {st.name} ({code})
                          </span>
                        </span>
                      );
                    })}
                  </div>
                  <div className="chart-box">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={casesChartData}
                        margin={{ top: 10, right: 18, left: 10, bottom: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf0" />
                        <XAxis
                          dataKey="year"
                          tick={{ fontSize: 12, fill: '#425466' }}
                          tickLine={{ stroke: '#cbd5e1' }}
                          axisLine={{ stroke: '#cbd5e1' }}
                        />
                        <YAxis
                          tickFormatter={(v: number) =>
                            v >= 1_000_000
                              ? `${(v / 1_000_000).toFixed(1)}M`
                              : v >= 1_000
                                ? `${(v / 1_000).toFixed(0)}k`
                                : String(v)
                          }
                          tick={{ fontSize: 12, fill: '#425466' }}
                          tickLine={{ stroke: '#cbd5e1' }}
                          axisLine={{ stroke: '#cbd5e1' }}
                          width={56}
                        />
                        <Tooltip
                          content={({ active, label }) => {
                            if (!active || label === undefined) return null;
                            const yr = Number(label);
                            return (
                              <div className="chart-tooltip">
                                <div className="tooltip-year">
                                  {activeDisease.disease_name} Reported Cases — {yr}
                                </div>
                                {filters.countryCodes.map((code) => {
                                  const st = COUNTRY_STYLES[code];
                                  const rec = casesLookup.get(`${yr}:${code}`);
                                  const val = rec ? rec.reported_cases : null;
                                  return (
                                    <div key={code}>
                                      <div className="tooltip-row">
                                        <span className="tooltip-country">
                                          <CountryMarkerIcon
                                            shape={st.shape}
                                            color={st.color}
                                            size={10}
                                          />
                                          {st.name}
                                        </span>
                                        <span
                                          className={`tooltip-val ${val === null ? 'missing' : ''}`}
                                        >
                                          {val === null
                                            ? 'Unavailable'
                                            : `${formatCases(val)} cases`}
                                        </span>
                                      </div>
                                      {rec?.disease_code === 'COVID19' &&
                                        rec.weeks_reported !== null && (
                                          <div className="tooltip-meta">
                                            Reporting weeks: {rec.weeks_reported}
                                            {rec.weeks_reported < 52 ? ' (partial year)' : ' weeks'}
                                          </div>
                                        )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          }}
                        />
                        {filters.countryCodes.map((code) => {
                          const st = COUNTRY_STYLES[code];
                          return (
                            <Line
                              key={code}
                              type="monotone"
                              dataKey={code}
                              name={st.name}
                              stroke={st.color}
                              strokeWidth={2.2}
                              connectNulls={false}
                              isAnimationActive={false}
                              dot={(props) => {
                                const el = renderCountryChartDot({
                                  cx: props.cx,
                                  cy: props.cy,
                                  value: props.value,
                                  shape: st.shape,
                                  color: st.color,
                                });
                                return el ? (
                                  React.cloneElement(el, { key: `c-${code}-${props.index}` })
                                ) : (
                                  <g key={`c-${code}-${props.index}`} />
                                );
                              }}
                              activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2, fill: st.color }}
                            />
                          );
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </section>
          </div>

          {/* Side Column: Latest-Year Comparison + Contextual Data & Source Notes */}
          <aside className="side-column" aria-label="Comparison and data notes">
            {/* Compact Latest-Year Comparison */}
            <section className="card" aria-labelledby="latest-comparison-heading">
              <div className="card-header" style={{ marginBottom: 6 }}>
                <div>
                  <h3 id="latest-comparison-heading" className="card-title" style={{ fontSize: 14.5 }}>
                    {activeVaccine.indicator_code} Comparison ({effectiveComparisonYear})
                  </h3>
                  <p className="card-subtitle">
                    Fixed country order · Unavailable values are not ranked
                  </p>
                </div>
                <select
                  aria-label="Comparison year"
                  className="select-input tabular"
                  style={{ fontSize: 12, padding: '3px 7px' }}
                  value={effectiveComparisonYear}
                  onChange={(e) => setComparisonYearOverride(Number(e.target.value))}
                >
                  {yearsInWindow
                    .slice()
                    .reverse()
                    .map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                </select>
              </div>

              {comparisonItems.every((it) => it.coverage_percent === null) &&
                latestAvailableCoverageYear !== null &&
                latestAvailableCoverageYear !== effectiveComparisonYear && (
                  <div className="note-box amber" style={{ marginBottom: 10, fontSize: 12 }}>
                    All selected countries are unavailable in {effectiveComparisonYear}.{' '}
                    <button
                      type="button"
                      style={{
                        border: 'none',
                        background: 'none',
                        padding: 0,
                        color: 'inherit',
                        fontWeight: 700,
                        textDecoration: 'underline',
                        cursor: 'pointer',
                      }}
                      onClick={() => setComparisonYearOverride(latestAvailableCoverageYear)}
                    >
                      View {latestAvailableCoverageYear}
                    </button>
                    {filters.vaccineCode === 'COVID19_PRIMARY' &&
                      filters.yearFrom <= 2023 &&
                      filters.yearTo >= 2023 && (
                        <>
                          {' '}
                          or{' '}
                          <button
                            type="button"
                            style={{
                              border: 'none',
                              background: 'none',
                              padding: 0,
                              color: 'inherit',
                              fontWeight: 700,
                              textDecoration: 'underline',
                              cursor: 'pointer',
                            }}
                            onClick={() => setComparisonYearOverride(2023)}
                          >
                            2023 (all 5)
                          </button>
                        </>
                      )}
                    .
                  </div>
                )}

              <div className="comparison-list">
                {comparisonItems.map((item) => {
                  const st = COUNTRY_STYLES[item.country_code];
                  const hasVal = item.coverage_percent !== null;
                  return (
                    <div key={item.country_code} className="comparison-row">
                      <div className="comparison-top">
                        <span className="comparison-name">
                          <CountryMarkerIcon shape={st.shape} color={st.color} size={10} />
                          {item.country_name}
                        </span>
                        <span className={`comparison-val ${hasVal ? '' : 'unavailable'}`}>
                          {formatCoverage(item.coverage_percent)}
                        </span>
                      </div>
                      <div className="bar-track" aria-hidden="true">
                        <div
                          className="bar-fill"
                          style={{
                            width: hasVal ? `${Math.min(100, item.coverage_percent!)}%` : '0%',
                            backgroundColor: st.color,
                          }}
                        />
                      </div>
                      {item.coverage_date && (
                        <div className="comparison-meta tabular">
                          Snapshot: {item.coverage_date} · {item.organization}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}
                  onClick={() => onJumpToExplorer('coverage')}
                >
                  Coverage table
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}
                  onClick={() => onJumpToExplorer('cases')}
                >
                  Cases table
                </button>
              </div>
            </section>

            {/* Contextual Data Notes */}
            <section className="card" aria-labelledby="data-notes-heading">
              <h3 id="data-notes-heading" className="card-title" style={{ fontSize: 14.5, marginBottom: 10 }}>
                Data Notes &amp; Provenance
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filters.vaccineCode === 'DTP3' && (
                  <div className="note-box green">
                    <div className="note-title">
                      <Info size={14} aria-hidden="true" />
                      Combination Vaccine (DTP3)
                    </div>
                    DTP3 measures one vaccination coverage series, while diphtheria, tetanus, and
                    pertussis are stored as three separate disease case series via{' '}
                    <code className="mono">vaccine_disease</code>. Counts are never summed into
                    &ldquo;DTP3 cases,&rdquo; and DTP3 coverage is never duplicated.
                  </div>
                )}

                {filters.vaccineCode === 'COVID19_PRIMARY' && (
                  <div className="note-box amber">
                    <div className="note-title">
                      <AlertTriangle size={14} aria-hidden="true" />
                      Dated Snapshots &amp; Partial Reporting Weeks
                    </div>
                    COVID-19 primary coverage reflects dated snapshots ({covidSnapshots.length}{' '}
                    dated records in range; India&rsquo;s 2024 snapshot of 67.18% is dated{' '}
                    <span className="tabular">2024-08-12</span> from Our World in Data). Later
                    2024–2025 snapshots are unavailable for most countries.
                    {partialCovidWeeks.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <strong>Partial case-reporting years in view:</strong>{' '}
                        {partialCovidWeeks
                          .map((r) => `${r.country_code} ${r.report_year} (${r.weeks_reported} wks)`)
                          .join(', ')}
                        .
                      </div>
                    )}
                  </div>
                )}

                {(coverageMissingCount > 0 || casesMissingCount > 0 || casesZeroCount > 0) && (
                  <div className="note-box">
                    <div className="note-title">
                      <Info size={14} aria-hidden="true" />
                      Availability in Current Filter
                    </div>
                    <div className="tabular">
                      Coverage: {filteredCoverage.length - coverageMissingCount} available,{' '}
                      {coverageMissingCount} unavailable.
                      <br />
                      {activeDisease.disease_name} cases: {casesAvailableCount} available (
                      {casesZeroCount} explicit zero{casesZeroCount === 1 ? '' : 's'}),{' '}
                      {casesMissingCount} unavailable.
                    </div>
                  </div>
                )}

                <div className="note-box">
                  <div className="note-title">Interpretation Boundary</div>
                  Coverage is an estimated percentage of a target population; reported cases are
                  surveillance counts. Observed patterns do not establish that changes in coverage
                  caused changes in reported cases.
                </div>

                {/* Source Attribution */}
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: 'var(--text-muted)',
                      marginBottom: 4,
                    }}
                  >
                    Active Sources (Workbook Data)
                  </div>
                  <ul className="source-list">
                    {activeSources.map((src) => (
                      <li key={src.source_id} className="source-item">
                        <div className="source-org">{src.organization}</div>
                        <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>
                          {src.source_name}
                        </div>
                        <a
                          href={src.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="source-link"
                        >
                          <ExternalLink size={11} aria-hidden="true" />
                          {src.source_code}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
};
