import { useRef, useState } from 'react';
import { api, downloadFile } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';

// Toolbar strip: "Export CSV" always; template download + bulk upload when an
// importEntity is provided (operator/admin only). CSVs open directly in
// Excel / Google Sheets.
export default function ImportExportBar({ exportEntity, importEntity, onImported, exportLabel = 'Export CSV' }) {
    const { hasRole } = useAuth();
    const fileRef = useRef(null);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    async function handleExport() {
        setError('');
        try {
            await downloadFile(`/export/${exportEntity}`);
        } catch (err) {
            setError(err.message);
        }
    }

    async function handleTemplate() {
        setError('');
        try {
            await downloadFile(`/import/${importEntity}/template`);
        } catch (err) {
            setError(err.message);
        }
    }

    async function handleFileChosen(e) {
        const file = e.target.files?.[0];
        e.target.value = ''; // allow re-choosing the same file
        if (!file) return;
        setBusy(true);
        setError('');
        setResult(null);
        try {
            const csv = await file.text();
            const res = await api.post(`/import/${importEntity}`, { csv });
            setResult(res);
            onImported?.();
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn secondary small" onClick={handleExport}>⬇ {exportLabel}</button>
                {importEntity && hasRole('operator') && (
                    <>
                        <button className="btn secondary small" onClick={handleTemplate}>⬇ Template</button>
                        <button className="btn small" disabled={busy} onClick={() => fileRef.current?.click()}>
                            {busy ? 'Uploading…' : '⬆ Bulk upload CSV'}
                        </button>
                        <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleFileChosen} />
                    </>
                )}
            </div>
            {error && <div className="error-banner">{error}</div>}
            {result && (
                <div className="card" style={{ padding: '10px 14px', fontSize: 12.5 }}>
                    <strong>Import complete:</strong> {result.inserted} added, {result.skipped} skipped of {result.totalRows} rows.
                    {result.errors?.length > 0 && (
                        <details style={{ marginTop: 6, color: 'var(--text-dim)' }}>
                            <summary style={{ cursor: 'pointer' }}>{result.errors.length} issue(s)</summary>
                            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                            </ul>
                        </details>
                    )}
                </div>
            )}
        </div>
    );
}
