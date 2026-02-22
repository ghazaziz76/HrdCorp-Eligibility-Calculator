import React from 'react';
import { RATES as RATES_STATIC } from '../data/acm-rates.js';
import { CLAIM_DOCS as CLAIM_DOCS_STATIC } from '../data/acm-documents.js';

const ACMDataContext = React.createContext(null);

const VERSION_DEFAULT = {
    acm_guide_edition: 'September 2025',
    acm_table_edition: 'November 2025',
    last_reviewed:     '2025-11-01',
};

export function ACMDataProvider({ children }) {
    const [rates,     setRates]     = React.useState(RATES_STATIC);
    const [claimDocs, setClaimDocs] = React.useState(CLAIM_DOCS_STATIC);
    const [version,   setVersion]   = React.useState(VERSION_DEFAULT);

    // Fetch live data from backend on mount.
    // Falls back silently to static file values if the server is unreachable.
    React.useEffect(() => {
        Promise.all([
            fetch('/api/rates').then(r => r.ok ? r.json() : null).catch(() => null),
            fetch('/api/docs').then(r => r.ok ? r.json() : null).catch(() => null),
            fetch('/api/version').then(r => r.ok ? r.json() : null).catch(() => null),
        ]).then(([ratesData, docsData, versionData]) => {
            if (ratesData)               setRates(ratesData);
            if (docsData?.claim_docs)    setClaimDocs(docsData.claim_docs);
            if (versionData)             setVersion(versionData);
        });
    }, []);

    const reload = () => {
        fetch('/api/rates').then(r => r.ok ? r.json() : null).catch(() => null).then(d => d && setRates(d));
        fetch('/api/docs').then(r => r.ok ? r.json() : null).catch(() => null).then(d => d?.claim_docs && setClaimDocs(d.claim_docs));
        fetch('/api/version').then(r => r.ok ? r.json() : null).catch(() => null).then(d => d && setVersion(d));
    };

    return (
        <ACMDataContext.Provider value={{ rates, claimDocs, version, reload }}>
            {children}
        </ACMDataContext.Provider>
    );
}

export const useACMData = () => React.useContext(ACMDataContext);
