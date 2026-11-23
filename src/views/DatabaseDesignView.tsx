import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  FileText,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Database,
} from 'lucide-react';
import {
  formatCases,
  formatCoverage,
  getAllCaseRows,
  getAllCoverageRows,
  getCountries,
  getDatasetMetadata,
  runExample1MeaslesByYear,
  runExample2Dtp3DiseaseCounts,
  runExample3SourceTrace,
} from '../data/databaseRepository';
import type { CaseJoinedRow, CoverageJoinedRow } from '../types/database';

export const DatabaseDesignView: React.FC = () => {
  const [zoomPercent, setZoomPercent] = useState(100);
  const [ex1Year, setEx1Year] = useState(2025);
  const [ex2Year, setEx2Year] = useState(2024);
  const [ex2Country, setEx2Country] = useState<string>('ALL');
  const [ex3Table, setEx3Table] = useState<'coverage' | 'cases'>('coverage');
  const [ex3RecordId, setEx3RecordId] = useState<number>(19); // India 2024 COVID-19 OWID snapshot
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const meta = getDatasetMetadata();
  const counts = meta.validation.rowCounts;
  const countries = getCountries();

  const years = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

  const ex1Rows = useMemo(() => runExample1MeaslesByYear(ex1Year), [ex1Year]);
  const ex2Rows = useMemo(
    () => runExample2Dtp3DiseaseCounts(ex2Year, ex2Country),
    [ex2Year, ex2Country],
  );

  // Curated notable records for Example 3 source trace (plus full option range)
  const coverageSampleOptions = useMemo(() => {
    const all = getAllCoverageRows();
    const highlights = [19, 1, 75, 115, 225]; // India COVID 2024 OWID, KOR COVID 2021, MCV1, DTP3, IPV1
    return highlights
      .map((id) => all.find((r) => r.record_id === id))
      .filter((x): x is CoverageJoinedRow => Boolean(x));
  }, []);

  const caseSampleOptions = useMemo(() => {
    const all = getAllCaseRows();
    const highlights = [32, 260, 325, 3, 1]; // KOR 2021 Measles 0, IND 2025 COVID 46wks, NPL 2025 COVID 48wks, KOR 2016 Diphtheria 0, KOR 2016 HepB NULL
    return highlights
      .map((id) => all.find((r) => r.case_report_id === id))
      .filter((x): x is CaseJoinedRow => Boolean(x));
  }, []);

  const ex3Result = useMemo(
    () => runExample3SourceTrace(ex3Table, ex3RecordId),
    [ex3Table, ex3RecordId],
  );

  const sqlExample1 = `SELECT c.country_code, c.country_name, vc.report_year, vc.coverage_percent
FROM vaccination_coverage vc
JOIN country c ON vc.country_id = c.country_id
JOIN vaccine_indicator v ON vc.vaccine_id = v.vaccine_id
WHERE v.indicator_code = 'MCV1'
  AND vc.report_year = ${ex1Year}
ORDER BY c.country_id;`;

  const sqlExample2 = `SELECT c.country_code, c.country_name, d.disease_name,
       dc.report_year, dc.reported_cases
FROM vaccine_indicator v
JOIN vaccine_disease vd ON v.vaccine_id = vd.vaccine_id
JOIN disease d ON vd.disease_id = d.disease_id
JOIN disease_case_count dc ON dc.disease_id = d.disease_id
JOIN country c ON dc.country_id = c.country_id
WHERE v.indicator_code = 'DTP3'
  AND dc.report_year = ${ex2Year}${ex2Country !== 'ALL' ? `\n  AND c.country_code = '${ex2Country}'` : ''}
ORDER BY c.country_id, d.disease_id;`;

  const sqlExample3 =
    ex3Table === 'coverage'
      ? `SELECT vc.record_id, c.country_name, v.indicator_code, vc.report_year,
       vc.coverage_percent, vc.coverage_date,
       ds.source_code, ds.organization, ds.source_url
FROM vaccination_coverage vc
JOIN country c ON vc.country_id = c.country_id
JOIN vaccine_indicator v ON vc.vaccine_id = v.vaccine_id
JOIN data_source ds ON vc.source_id = ds.source_id
WHERE vc.record_id = ${ex3RecordId};`
      : `SELECT dc.case_report_id, c.country_name, d.disease_name, dc.report_year,
       dc.reported_cases, ds.source_code, ds.organization, ds.source_url
FROM disease_case_count dc
JOIN country c ON dc.country_id = c.country_id
JOIN disease d ON dc.disease_id = d.disease_id
JOIN data_source ds ON dc.source_id = ds.source_id
WHERE dc.case_report_id = ${ex3RecordId};`;

  const copySql = async (key: string, sql: string) => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const schemaTables = [
    {
      name: 'country',
      role: 'Lookup · 5 rows',
      rows: counts.country,
      purpose: 'Stores the five study countries using standardized ISO-3 codes and names.',
      keys: 'PK: country_id | UQ: country_code, country_name',
    },
    {
      name: 'vaccine_indicator',
      role: 'Lookup · 5 rows',
      rows: counts.vaccine_indicator,
      purpose:
        'Defines each vaccine indicator (HepB3, MCV1, DTP3, IPV1, COVID19_PRIMARY), its dose series, and ROUTINE vs. COVID19 category.',
      keys: 'PK: vaccine_id | UQ: indicator_code',
    },
    {
      name: 'disease',
      role: 'Lookup · 7 rows',
      rows: counts.disease,
      purpose:
        'Stores each vaccine-preventable disease independently so diphtheria, tetanus, and pertussis remain separate series.',
      keys: 'PK: disease_id | UQ: disease_code, disease_name',
    },
    {
      name: 'data_source',
      role: 'Provenance · 4 rows',
      rows: counts.data_source,
      purpose:
        'Stores official dataset metadata (WHO/UNICEF, WHO Surveillance, WHO COVID-19 Dashboard, OWID) once to eliminate 3NF transitive dependencies.',
      keys: 'PK: source_id | UQ: source_code',
    },
    {
      name: 'vaccine_disease',
      role: 'M:N Junction · 7 rows',
      rows: counts.vaccine_disease,
      purpose:
        'Resolves the many-to-many VACCINE–PREVENTS–DISEASE relationship so one combination vaccine (DTP3) maps cleanly to three diseases.',
      keys: 'PK: (vaccine_id, disease_id) | FK: vaccine_id → vaccine_indicator, disease_id → disease',
    },
    {
      name: 'vaccination_coverage',
      role: `Fact · ${counts.vaccination_coverage} rows`,
      rows: counts.vaccination_coverage,
      purpose:
        'Stores one annual coverage percentage (0–100% or NULL) per country, indicator, and year, plus optional snapshot coverage_date for COVID-19.',
      keys: 'PK: record_id | FK: country_id, vaccine_id, source_id | UQ: (country_id, vaccine_id, report_year)',
    },
    {
      name: 'disease_case_count',
      role: `Fact · ${counts.disease_case_count} rows`,
      rows: counts.disease_case_count,
      purpose:
        'Stores one annual reported case count (non-negative integer or NULL) per country, disease, and year, preserving confirmed zeros as 0.',
      keys: 'PK: case_report_id | FK: country_id, disease_id, source_id | UQ: (country_id, disease_id, report_year)',
    },
    {
      name: 'covid_reporting_weeks',
      role: `Supplementary · ${counts.covid_reporting_weeks} rows`,
      rows: counts.covid_reporting_weeks,
      purpose:
        'Workbook supplementary sheet joined on case_report_id to record weekly reporting completeness for annual COVID-19 case totals.',
      keys: 'PK/FK: case_report_id → disease_case_count | Column: weeks_reported (0–53 or NULL)',
    },
  ];

  return (
    <div className="design-stack">
      {/* 1. Interactive ER Diagram */}
      <section className="card" aria-labelledby="er-diagram-heading">
        <div className="er-toolbar">
          <div>
            <h2 id="er-diagram-heading" className="card-title">
              Conceptual Entity Relationship Diagram (Chen Notation)
            </h2>
            <p className="card-subtitle">
              Official project diagram (ER_Diagram_Final.svg) using Elmasri &amp; Navathe (min, max)
              participation cardinalities
            </p>
          </div>
          <div className="filter-group">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setZoomPercent((z) => Math.max(60, z - 20))}
              aria-label="Zoom out ER diagram"
            >
              <ZoomOut size={14} aria-hidden="true" />
            </button>
            <span className="tabular" style={{ fontSize: 12.5, fontWeight: 600, minWidth: 44, textAlign: 'center' }}>
              {zoomPercent}%
            </span>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setZoomPercent((z) => Math.min(200, z + 20))}
              aria-label="Zoom in ER diagram"
            >
              <ZoomIn size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setZoomPercent(100)}
              title="Reset zoom to fit"
            >
              <Maximize2 size={13} aria-hidden="true" />
              Fit
            </button>
            <a
              href={`${import.meta.env.BASE_URL}assets/ER_Diagram_Final.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
              style={{ textDecoration: 'none' }}
            >
              <FileText size={14} aria-hidden="true" />
              Open PDF
            </a>
          </div>
        </div>

        <div className="er-viewport" tabIndex={0} aria-label="Scrollable ER diagram container">
          <img
            src={`${import.meta.env.BASE_URL}assets/ER_Diagram_Final.svg`}
            alt="Chen notation Entity Relationship Diagram showing COUNTRY, VACCINE, DISEASE, VACCINATION_RECORD, DISEASE_CASE_REPORT, and DATA_SOURCE entities with min-max cardinalities"
            className="er-img"
            style={{ width: `${zoomPercent}%`, maxWidth: 'none' }}
          />
        </div>
      </section>

      {/* 2. Seven-Table 3NF Design + DTP3 Explanation */}
      <section className="card" aria-labelledby="schema-overview-heading">
        <h2 id="schema-overview-heading" className="card-title">
          Seven-Table Normalized Schema (3NF)
        </h2>
        <p className="card-subtitle" style={{ marginBottom: 12 }}>
          Validated directly against <code className="mono">{meta.workbookFile}</code> ·{' '}
          {meta.validation.foreignKeysValid ? 'All foreign keys valid' : 'FK error'} ·{' '}
          {meta.validation.duplicateNaturalKeys} duplicate natural keys
        </p>

        <div className="note-box green" style={{ marginBottom: 14 }}>
          <div className="note-title">
            <Database size={14} aria-hidden="true" />
            Why Coverage and Cases Live in Separate Tables — The DTP3 Example
          </div>
          DTP3 is a combination vaccine with <strong>one</strong> annual coverage percentage per
          country (stored once in <code className="mono">vaccination_coverage</code>), yet it
          protects against <strong>three</strong> distinct diseases—diphtheria, tetanus, and
          pertussis—each reported separately in <code className="mono">disease_case_count</code>.
          Connecting <code className="mono">vaccine_indicator</code> and{' '}
          <code className="mono">disease</code> through the{' '}
          <code className="mono">vaccine_disease</code> junction table lets queries retrieve all
          three disease series for DTP3 without ever duplicating DTP3 coverage percentages or
          erroneously summing the three diseases into a single &ldquo;DTP3 cases&rdquo; number.
        </div>

        <div className="schema-grid">
          {schemaTables.map((t) => (
            <div key={t.name} className="schema-table-card">
              <div className="schema-table-top">
                <span className="schema-table-name">{t.name}</span>
                <span className="schema-role-tag">{t.role}</span>
              </div>
              <p style={{ margin: 0, fontSize: 12.8, color: 'var(--text-secondary)' }}>
                {t.purpose}
              </p>
              <p className="schema-keys">{t.keys}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Three Read-Only SQL Examples (Workbook Data Mode) */}
      <section className="card" aria-labelledby="sql-examples-heading">
        <div className="card-header">
          <div>
            <h2 id="sql-examples-heading" className="card-title">
              Read-Only SQL Examples for MySQL Recreation
            </h2>
            <p className="card-subtitle">
              Displayed tables below are computed from bundled <strong>Workbook data</strong> (
              <code className="mono">{meta.workbookFile}</code>). The SQL snippets show the exact
              parameterized read-only queries for a configured MySQL{' '}
              <code className="mono">vaccination_management</code> instance.
            </p>
          </div>
          <span className="data-mode-pill">
            <span className="data-mode-dot" />
            Workbook data
          </span>
        </div>

        {/* Example 1 */}
        <div className="sql-card">
          <div className="card-header" style={{ marginBottom: 6 }}>
            <div>
              <h3 className="card-title" style={{ fontSize: 14.5 }}>
                1. Compare Measles (MCV1) coverage across countries for a chosen year
              </h3>
            </div>
            <div className="filter-group">
              <label style={{ fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Year
                <select
                  aria-label="Example 1 Measles year"
                  className="select-input tabular"
                  value={ex1Year}
                  onChange={(e) => setEx1Year(Number(e.target.value))}
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => copySql('ex1', sqlExample1)}
              >
                {copiedKey === 'ex1' ? <Check size={13} /> : <Copy size={13} />}
                {copiedKey === 'ex1' ? 'Copied' : 'Copy SQL'}
              </button>
            </div>
          </div>

          <pre className="sql-pre">
            <code>{sqlExample1}</code>
          </pre>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>country_code</th>
                  <th>country_name</th>
                  <th className="num-col">report_year</th>
                  <th className="num-col">coverage_percent (%)</th>
                </tr>
              </thead>
              <tbody>
                {ex1Rows.map((r) => (
                  <tr key={r.record_id}>
                    <td className="mono">{r.country_code}</td>
                    <td style={{ fontWeight: 600 }}>{r.country_name}</td>
                    <td className="num-col tabular">{r.report_year}</td>
                    <td className="num-col tabular">
                      {r.coverage_percent === null ? (
                        <span className="badge-missing">Unavailable</span>
                      ) : (
                        <strong>{formatCoverage(r.coverage_percent)}</strong>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Example 2 */}
        <div className="sql-card">
          <div className="card-header" style={{ marginBottom: 6 }}>
            <div>
              <h3 className="card-title" style={{ fontSize: 14.5 }}>
                2. Retrieve diphtheria, tetanus, and pertussis counts linked to DTP3
              </h3>
            </div>
            <div className="filter-group">
              <label style={{ fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Year
                <select
                  aria-label="Example 2 DTP3 year"
                  className="select-input tabular"
                  value={ex2Year}
                  onChange={(e) => setEx2Year(Number(e.target.value))}
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Country
                <select
                  aria-label="Example 2 DTP3 country"
                  className="select-input"
                  value={ex2Country}
                  onChange={(e) => setEx2Country(e.target.value)}
                >
                  <option value="ALL">All 5 countries</option>
                  {countries.map((c) => (
                    <option key={c.country_code} value={c.country_code}>
                      {c.country_name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => copySql('ex2', sqlExample2)}
              >
                {copiedKey === 'ex2' ? <Check size={13} /> : <Copy size={13} />}
                {copiedKey === 'ex2' ? 'Copied' : 'Copy SQL'}
              </button>
            </div>
          </div>

          <pre className="sql-pre">
            <code>{sqlExample2}</code>
          </pre>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>country_code</th>
                  <th>country_name</th>
                  <th>disease_name</th>
                  <th className="num-col">report_year</th>
                  <th className="num-col">reported_cases (count)</th>
                </tr>
              </thead>
              <tbody>
                {ex2Rows.map((r) => (
                  <tr key={r.case_report_id}>
                    <td className="mono">{r.country_code}</td>
                    <td style={{ fontWeight: 600 }}>{r.country_name}</td>
                    <td>{r.disease_name}</td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Example 3 */}
        <div className="sql-card">
          <div className="card-header" style={{ marginBottom: 6 }}>
            <div>
              <h3 className="card-title" style={{ fontSize: 14.5 }}>
                3. Trace a coverage or case record to its official source
              </h3>
            </div>
            <div className="filter-group">
              <div className="segmented-control">
                <button
                  type="button"
                  className={`seg-btn ${ex3Table === 'coverage' ? 'active-green' : ''}`}
                  style={{ fontSize: 12, padding: '4px 9px' }}
                  onClick={() => {
                    setEx3Table('coverage');
                    setEx3RecordId(19);
                  }}
                >
                  Coverage
                </button>
                <button
                  type="button"
                  className={`seg-btn ${ex3Table === 'cases' ? 'active-green' : ''}`}
                  style={{ fontSize: 12, padding: '4px 9px' }}
                  onClick={() => {
                    setEx3Table('cases');
                    setEx3RecordId(32);
                  }}
                >
                  Cases
                </button>
              </div>
              <select
                aria-label="Choose record to trace"
                className="select-input"
                value={ex3RecordId}
                onChange={(e) => setEx3RecordId(Number(e.target.value))}
              >
                {ex3Table === 'coverage'
                  ? coverageSampleOptions.map((r) => (
                      <option key={r.record_id} value={r.record_id}>
                        #{r.record_id} · {r.country_code} {r.indicator_code} {r.report_year}
                      </option>
                    ))
                  : caseSampleOptions.map((r) => (
                      <option key={r.case_report_id} value={r.case_report_id}>
                        #{r.case_report_id} · {r.country_code} {r.disease_name} {r.report_year}
                      </option>
                    ))}
              </select>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => copySql('ex3', sqlExample3)}
              >
                {copiedKey === 'ex3' ? <Check size={13} /> : <Copy size={13} />}
                {copiedKey === 'ex3' ? 'Copied' : 'Copy SQL'}
              </button>
            </div>
          </div>

          <pre className="sql-pre">
            <code>{sqlExample3}</code>
          </pre>

          {ex3Result && (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Country</th>
                    <th>{ex3Table === 'coverage' ? 'Indicator' : 'Disease'}</th>
                    <th className="num-col">Year</th>
                    <th className="num-col">
                      {ex3Table === 'coverage' ? 'Coverage (%)' : 'Reported Cases (count)'}
                    </th>
                    <th>{ex3Table === 'coverage' ? 'Snapshot Date' : 'Reporting Weeks'}</th>
                    <th>Official Source</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="mono tabular">
                      {'record_id' in ex3Result ? ex3Result.record_id : ex3Result.case_report_id}
                    </td>
                    <td style={{ fontWeight: 600 }}>{ex3Result.country_name}</td>
                    <td>
                      {'indicator_code' in ex3Result
                        ? `${ex3Result.indicator_code} (${ex3Result.vaccine_name})`
                        : ex3Result.disease_name}
                    </td>
                    <td className="num-col tabular">{ex3Result.report_year}</td>
                    <td className="num-col tabular">
                      {'coverage_percent' in ex3Result ? (
                        ex3Result.coverage_percent === null ? (
                          <span className="badge-missing">Unavailable</span>
                        ) : (
                          <strong>{formatCoverage(ex3Result.coverage_percent)}</strong>
                        )
                      ) : ex3Result.reported_cases === null ? (
                        <span className="badge-missing">Unavailable</span>
                      ) : ex3Result.reported_cases === 0 ? (
                        <span className="badge-zero">
                          0 <span className="badge-zero-tag">Reported zero</span>
                        </span>
                      ) : (
                        <strong>{formatCases(ex3Result.reported_cases)}</strong>
                      )}
                    </td>
                    <td className="tabular">
                      {'coverage_date' in ex3Result
                        ? ex3Result.coverage_date ?? <span className="badge-missing">—</span>
                        : ex3Result.weeks_reported !== null
                          ? `${ex3Result.weeks_reported} wks`
                          : <span className="badge-missing">—</span>}
                    </td>
                    <td>
                      <a
                        href={ex3Result.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="source-link"
                      >
                        {ex3Result.organization} · {ex3Result.source_code}
                        <ExternalLink size={11} aria-hidden="true" />
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
