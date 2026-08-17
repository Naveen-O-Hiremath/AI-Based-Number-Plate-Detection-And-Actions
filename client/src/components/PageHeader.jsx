export default function PageHeader({ title, subtitle, actions }) {
    return (
        <div className="topbar">
            <div>
                <h1>{title}</h1>
                {subtitle && <p>{subtitle}</p>}
            </div>
            {actions && <div>{actions}</div>}
        </div>
    );
}
