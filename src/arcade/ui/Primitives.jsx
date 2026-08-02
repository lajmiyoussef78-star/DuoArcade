// Small presentational primitives shared by the dashboard shell.
// No data fetching here — every consumer passes real values in.

export function Panel({ as: Tag = 'section', tone = '', className = '', children, ...rest }) {
  return (
    <Tag className={['ui-panel', tone && `ui-panel-${tone}`, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </Tag>
  );
}

export function SectionHead({ title, sub = null, action = null, id = undefined }) {
  return (
    <div className="ui-sechead" id={id}>
      <div className="ui-sechead-copy">
        <h3 className="ui-sechead-title">{title}</h3>
        {sub && <p className="ui-sechead-sub">{sub}</p>}
      </div>
      {action && <div className="ui-sechead-action">{action}</div>}
    </div>
  );
}

export function Badge({ tone = 'neutral', icon = null, children, title = undefined }) {
  return (
    <span className={`ui-badge ui-badge-${tone}`} title={title}>
      {icon}
      <span>{children}</span>
    </span>
  );
}

export function ProgressBar({ value = 0, max = 100, label = null, tone = 'acc' }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (100 * value) / max)) : 0;
  return (
    <div className="ui-progress-wrap">
      <div
        className={`ui-progress ui-progress-${tone}`}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <span className="ui-progress-fill" style={{ width: pct + '%' }} />
      </div>
      {label && <div className="ui-progress-label">{label}</div>}
    </div>
  );
}

export function StatusDot({ state = 'offline' }) {
  return <span className={`ui-dot ui-dot-${state}`} aria-hidden="true" />;
}

export function IconButton({ label, onClick, children, active = false, className = '', ...rest }) {
  return (
    <button
      type="button"
      className={['ui-iconbtn', active && 'on', className].filter(Boolean).join(' ')}
      aria-label={label}
      title={label}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ActionButton({
  tone = 'primary', icon = null, onClick, children, sub = null, ...rest
}) {
  return (
    <button type="button" className={`ui-action ui-action-${tone}`} onClick={onClick} {...rest}>
      {icon && <span className="ui-action-ico">{icon}</span>}
      <span className="ui-action-copy">
        <span className="ui-action-label">{children}</span>
        {sub && <span className="ui-action-sub">{sub}</span>}
      </span>
    </button>
  );
}
