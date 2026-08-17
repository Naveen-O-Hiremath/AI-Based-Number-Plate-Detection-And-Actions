const PAGE_SIZES = [10, 20, 50, 100, 200];

export default function Pagination({ page, limit, total, onPageChange, onLimitChange }) {
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return (
        <div className="pagination">
            <button className="btn secondary small" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
                ← Prev
            </button>
            <span>Page {page} of {totalPages} · {total.toLocaleString()} records</span>
            <button className="btn secondary small" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
                Next →
            </button>
            {onLimitChange && (
                <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                    Show
                    <select
                        value={limit}
                        onChange={(e) => onLimitChange(Number(e.target.value))}
                        style={{ padding: '4px 8px' }}
                    >
                        {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    per page
                </label>
            )}
        </div>
    );
}
