export default function PublicProfileScreen({ profile, onBack }) {
  if (!profile) return null;
  const stats = d => {
    let a = 0, b = 0, dd = 0;
    for (const rec of Object.values(d.records || {})) { a += rec.a || 0; b += rec.b || 0; dd += rec.d || 0; }
    const taste = d.taste_total > 0 ? Math.round(100 * d.taste_agree / d.taste_total) + '%' : '—';
    return `${a + b + dd} games · ${d.evenings || 0} evenings · best streak ${d.best_streak || 0} · taste match ${taste}`;
  };
  return (
    <section className="on">
      <div className="card">
        <div className="duo-head">
          <h3 style={{ fontSize: 18 }}>@{profile.username}</h3>
          <button className="btn small ghost" onClick={onBack}>{'←'} Back</button>
        </div>
        <div>
          {!profile.duos.length && <div className="status">No public duos.</div>}
          {profile.duos.map((d, i) => (
            <div className="pub-duo" key={i}>
              <div className="dn">{d.name_a} & {d.name_b}</div>
              <div className="dm">{stats(d)}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
