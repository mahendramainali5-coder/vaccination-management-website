# Vaccination Management Database System — Interactive Website

Interactive web application for our **Ulsan College Database Design (DBSN-F2026)** project on **SDG 3 — Good Health and Well-Being**.

- **Team:** Utsab Mainali (2530108) and Krishna Budha Magar (2530112)
- **Countries:** South Korea (`KOR`), Japan (`JPN`), China (`CHN`), India (`IND`), and Nepal (`NPL`)
- **Indicators:** Routine childhood vaccination (`HepB3`, `MCV1`, `DTP3`, `IPV1`, 2016–2025) and COVID-19 completed primary series (2021–2025, where available)

---

## Data Mode Implemented

This website runs in **offline Workbook data mode** so classroom demonstrations work reliably without internet access or a running MySQL server:

- The repeatable import script (`scripts/import-workbook.mjs`) reads `../Vaccination_Project_Final_Fixed/Data/Vaccination_Final_Data_3NF.xlsx`, validates all primary keys, foreign keys, natural uniqueness keys, and numeric domains, and bundles the normalized JSON into `src/data/workbookData.json`.
- All displayed charts, tables, and SQL example results are explicitly labeled **Workbook data**.
- **Future MySQL connection note:** If a live MySQL backend is added later, connect only from a server-side read-only API using parameterized SQL queries (keep credentials in server environment variables, never in browser code) and display an explicit mode badge without silently falling back between MySQL and workbook data.

---

## Quick Start Commands

Run all commands inside the `Vaccination_Website` directory:

```bash
cd "/Users/mainaliutsab/DataBase Final Project/Vaccination_Website"

# 1. Install dependencies (one-time)
npm install

# 2. Re-import and validate data from Vaccination_Final_Data_3NF.xlsx
npm run import-data

# 3. Start the local development server (offline-ready)
npm run dev

# 4. Run production type-check and bundle build
npm run build

# 5. Preview the production build locally
npm run preview
```

Optional custom workbook path:

```bash
node scripts/import-workbook.mjs --source /path/to/Vaccination_Final_Data_3NF.xlsx
```

---

## Validated Workbook Summary

Running `npm run import-data` verifies all 8 sheets of `Vaccination_Final_Data_3NF.xlsx`:

| Sheet | Rows | Integrity Checks |
|---|---:|---|
| `country` | 5 | Unique `country_id`, unique `country_code` |
| `vaccine_indicator` | 5 | Unique `vaccine_id`, unique `indicator_code` |
| `disease` | 7 | Unique `disease_id`, unique `disease_code` |
| `data_source` | 4 | Unique `source_id`, unique `source_code` |
| `vaccine_disease` | 7 | Composite PK `(vaccine_id, disease_id)`, valid FKs |
| `vaccination_coverage` | 225 | 212 available, 13 blank/unavailable; unique `(country_id, vaccine_id, report_year)` |
| `disease_case_count` | 325 | 230 available (61 explicit `0`s), 95 blank/unavailable; unique `(country_id, disease_id, report_year)` |
| `covid_reporting_weeks` | 25 | Valid FK `case_report_id → disease_case_count`; records partial-year reporting weeks |

---

## Documented Discrepancies Between Final Report and Source Workbook

Per project instructions, `Vaccination_Final_Data_3NF.xlsx` is the single source of truth for all displayed figures. The following discrepancies in `Reports/Database_Design_Project_Final_Report.docx` were noted during inspection:

1. **Section 6.1 screenshots & Section 7.2 narrative carry-over:** As acknowledged in Section 6.1 of the report, the embedded screenshots depict an earlier 2020–2025 MySQL load (150 coverage rows, 30 Hepatitis B NULL rows), and Section 7.2 still references converting 2020 COVID-19 zeros from an earlier draft spreadsheet. By contrast, Section 6.2 and `Vaccination_Final_Data_3NF.xlsx` contain the complete repaired dataset: **225** coverage rows (routine 2016–2025; COVID-19 2021–2025) and **325** disease case rows, plus **25** `covid_reporting_weeks` rows.
2. **India 2024 COVID-19 snapshot date:** The report's Section 1.5 and `data_source.notes` describe India's OWID COVID-19 figure as "August 2024"; the workbook records the exact snapshot date `2024-08-12` (`67.18%`), which the website displays verbatim.
3. **ER diagram PDF/SVG note:** `ER_Diagram_Final.svg` documents `DATA_SOURCE` optional `notes` and notes that the `(1,N)` minimum on `VACCINE – PREVENTS – DISEASE` is a project rule while MySQL permits inserting a vaccine row before linking it in `vaccine_disease`. The website preserves and displays the unmodified `ER_Diagram_Final.svg` and `ER_Diagram_Final.pdf`.
