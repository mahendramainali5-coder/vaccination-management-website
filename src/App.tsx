import React, { useEffect, useState } from 'react';
import { BarChart3, Database, Table2 } from 'lucide-react';
import type { AppFilterState, AppView, ExplorerTab } from './types/database';
import {
  ALL_COUNTRY_CODES,
  DEFAULT_FILTER_STATE,
  VACCINE_TO_ALLOWED_DISEASES,
  VACCINE_TO_DEFAULT_DISEASE,
  getYearBoundsForVaccine,
  parseFilterStateFromUrl,
  serializeFilterStateToUrl,
} from './utils/urlState';
import { DashboardView } from './views/DashboardView';
import { DataExplorerView } from './views/DataExplorerView';
import { DatabaseDesignView } from './views/DatabaseDesignView';

export const App: React.FC = () => {
  const [filters, setFilters] = useState<AppFilterState>(() =>
    parseFilterStateFromUrl(window.location.search),
  );

  // Sync URL query parameters without polluting browser history on every toggle
  useEffect(() => {
    const nextSearch = serializeFilterStateToUrl(filters);
    if (window.location.search !== nextSearch) {
      window.history.replaceState(null, '', `${window.location.pathname}${nextSearch}`);
    }
  }, [filters]);

  // Support browser back/forward navigation if user shares or navigates via URL
  useEffect(() => {
    const onPopState = () => {
      setFilters(parseFilterStateFromUrl(window.location.search));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleChangeView = (view: AppView) => {
    setFilters((prev) => ({ ...prev, view }));
  };

  const handleChangeVaccine = (vaccineCode: string) => {
    setFilters((prev) => {
      const prevWasCovid = prev.vaccineCode === 'COVID19_PRIMARY';
      const nextIsCovid = vaccineCode === 'COVID19_PRIMARY';
      const bounds = getYearBoundsForVaccine(vaccineCode);

      let yearFrom = prev.yearFrom;
      let yearTo = prev.yearTo;

      if (nextIsCovid) {
        // Switching to COVID-19 uses its documented 2021–2025 range
        yearFrom = bounds.min;
        yearTo = bounds.max;
      } else if (prevWasCovid) {
        // Switching back from COVID-19 restores the full 2016–2025 routine period
        yearFrom = bounds.min;
        yearTo = bounds.max;
      } else {
        yearFrom = Math.max(bounds.min, Math.min(bounds.max, yearFrom));
        yearTo = Math.max(yearFrom, Math.min(bounds.max, yearTo));
      }

      const allowed = VACCINE_TO_ALLOWED_DISEASES[vaccineCode] ?? [];
      const diseaseCode = allowed.includes(prev.diseaseCode)
        ? prev.diseaseCode
        : VACCINE_TO_DEFAULT_DISEASE[vaccineCode];

      return {
        ...prev,
        vaccineCode,
        diseaseCode,
        yearFrom,
        yearTo,
      };
    });
  };

  const handleChangeDisease = (diseaseCode: string) => {
    setFilters((prev) => {
      // Keep vaccine indicator aligned when switching diseases from Data Explorer
      let vaccineCode = prev.vaccineCode;
      for (const [vCode, dCodes] of Object.entries(VACCINE_TO_ALLOWED_DISEASES)) {
        if (dCodes.includes(diseaseCode)) {
          vaccineCode = vCode;
          break;
        }
      }
      return { ...prev, vaccineCode, diseaseCode };
    });
  };

  const handleToggleCountry = (countryCode: string) => {
    setFilters((prev) => {
      const exists = prev.countryCodes.includes(countryCode);
      const next = exists
        ? prev.countryCodes.filter((c) => c !== countryCode)
        : ALL_COUNTRY_CODES.filter(
            (c) => prev.countryCodes.includes(c) || c === countryCode,
          );
      return { ...prev, countryCodes: [...next] };
    });
  };

  const handleSelectAllCountries = () => {
    setFilters((prev) => ({ ...prev, countryCodes: [...ALL_COUNTRY_CODES] }));
  };

  const handleChangeYearFrom = (yearFrom: number) => {
    setFilters((prev) => ({
      ...prev,
      yearFrom,
      yearTo: Math.max(yearFrom, prev.yearTo),
    }));
  };

  const handleChangeYearTo = (yearTo: number) => {
    setFilters((prev) => ({
      ...prev,
      yearFrom: Math.min(prev.yearFrom, yearTo),
      yearTo,
    }));
  };

  const handleResetFilters = () => {
    setFilters((prev) => ({
      ...DEFAULT_FILTER_STATE,
      view: prev.view,
      explorerTab: prev.explorerTab,
    }));
  };

  const handleChangeExplorerTab = (explorerTab: ExplorerTab) => {
    setFilters((prev) => ({ ...prev, explorerTab }));
  };

  const handleJumpToExplorer = (explorerTab: ExplorerTab) => {
    setFilters((prev) => ({ ...prev, view: 'explorer', explorerTab }));
  };

  return (
    <div className="app-shell">
      <header className="top-header">
        <div className="top-header-inner">
          <div className="brand-group">
            <span className="sdg-badge" title="UN Sustainable Development Goal 3">
              SDG 3
            </span>
            <div className="brand-text">
              <h1 className="brand-title">Vaccination Management Database System</h1>
              <span className="brand-subtitle">
                Good Health and Well-Being · Five-Country Coverage &amp; Disease Surveillance
              </span>
            </div>
          </div>

          <nav className="nav-tabs" aria-label="Primary navigation">
            <button
              type="button"
              className={`nav-tab ${filters.view === 'dashboard' ? 'active' : ''}`}
              aria-current={filters.view === 'dashboard' ? 'page' : undefined}
              onClick={() => handleChangeView('dashboard')}
            >
              <BarChart3 size={15} aria-hidden="true" />
              Dashboard
            </button>
            <button
              type="button"
              className={`nav-tab ${filters.view === 'explorer' ? 'active' : ''}`}
              aria-current={filters.view === 'explorer' ? 'page' : undefined}
              onClick={() => handleChangeView('explorer')}
            >
              <Table2 size={15} aria-hidden="true" />
              Data Explorer
            </button>
            <button
              type="button"
              className={`nav-tab ${filters.view === 'design' ? 'active' : ''}`}
              aria-current={filters.view === 'design' ? 'page' : undefined}
              onClick={() => handleChangeView('design')}
            >
              <Database size={15} aria-hidden="true" />
              Database Design
            </button>
          </nav>

          <div
            className="data-mode-pill"
            title="Running offline from bundled Vaccination_Final_Data_3NF.xlsx (no live MySQL connection active)"
          >
            <span className="data-mode-dot" aria-hidden="true" />
            Workbook data
          </div>
        </div>
      </header>

      <main className="main-content">
        {filters.view === 'dashboard' && (
          <DashboardView
            filters={filters}
            onChangeVaccine={handleChangeVaccine}
            onChangeDisease={handleChangeDisease}
            onToggleCountry={handleToggleCountry}
            onSelectAllCountries={handleSelectAllCountries}
            onChangeYearFrom={handleChangeYearFrom}
            onChangeYearTo={handleChangeYearTo}
            onResetFilters={handleResetFilters}
            onJumpToExplorer={handleJumpToExplorer}
          />
        )}

        {filters.view === 'explorer' && (
          <DataExplorerView
            filters={filters}
            onChangeExplorerTab={handleChangeExplorerTab}
            onChangeVaccine={handleChangeVaccine}
            onChangeDisease={handleChangeDisease}
            onToggleCountry={handleToggleCountry}
            onSelectAllCountries={handleSelectAllCountries}
            onChangeYearFrom={handleChangeYearFrom}
            onChangeYearTo={handleChangeYearTo}
            onResetFilters={handleResetFilters}
          />
        )}

        {filters.view === 'design' && <DatabaseDesignView />}
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-meta">
            <strong>Vaccination Management Database System</strong>
            <span>·</span>
            <span>Ulsan College · Database Design (DBSN-F2026)</span>
            <span>·</span>
            <span>Team: Utsab Mainali (2530108) &amp; Krishna Budha Magar (2530112)</span>
          </div>
          <div className="footer-disclaimer">
            Data mode: Bundled <strong>Workbook data</strong> (Vaccination_Final_Data_3NF.xlsx).
            Observed trends do not imply causation.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
