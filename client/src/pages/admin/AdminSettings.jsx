import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Settings, Save, CheckCircle2, Award, Clock, ShieldAlert, Coins } from 'lucide-react';

export default function AdminSettings() {
  const { token } = useAuth();
  const [settings, setSettings] = useState({
    session_duration_hours: '6',
    ads_per_session: '3',
    max_sessions_per_day: '2',
    coins_per_ad: '2',
    coin_expiry_days: '30',
    coin_value_inr: '1'
  });
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetch('/api/admin/reward-settings', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if (data.settings) setSettings(prev => ({ ...prev, ...data.settings }));
          if (data.levels) setLevels(data.levels || []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/reward-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ settings, levels })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage('Reward Economy & Session Rules updated and logged to audit logs!');
        setTimeout(() => setMessage(null), 4000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleLevelChange = (index, field, value) => {
    const updated = [...levels];
    updated[index] = { ...updated[index], [field]: value };
    setLevels(updated);
  };

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', color: '#f8fafc' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Settings size={26} color="#7c3aed" /> Platform Reward Economy Settings
        </h2>
        <p style={{ fontSize: '14px', color: '#cbd5e1' }}>
          Configure 6-hour session rules, ad limits, coin expiry, and membership discount caps.
        </p>
      </div>

      {message && (
        <div style={{ background: '#065f46', color: '#a7f3d0', border: '1px solid #059669', padding: '14px', borderRadius: '14px', marginBottom: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={18} /> {message}
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Section 1: Reward Sessions & Coin Economy */}
        <div style={{ background: '#1e293b', borderRadius: '20px', border: '1px solid #334155', padding: '24px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={20} color="#10b981" /> Reward Session & Coin Economy Rules
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Session Duration (Hours)</label>
              <input type="number" className="form-input" style={{ background: '#0f172a', border: '1px solid #334155', color: '#ffffff' }} value={settings.session_duration_hours} onChange={e => setSettings({ ...settings, session_duration_hours: e.target.value })} />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Max Ads Per Session</label>
              <input type="number" className="form-input" style={{ background: '#0f172a', border: '1px solid #334155', color: '#ffffff' }} value={settings.ads_per_session} onChange={e => setSettings({ ...settings, ads_per_session: e.target.value })} />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Max Sessions Per 24 Hours</label>
              <input type="number" className="form-input" style={{ background: '#0f172a', border: '1px solid #334155', color: '#ffffff' }} value={settings.max_sessions_per_day} onChange={e => setSettings({ ...settings, max_sessions_per_day: e.target.value })} />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Coins Awarded Per Ad</label>
              <input type="number" className="form-input" style={{ background: '#0f172a', border: '1px solid #334155', color: '#ffffff' }} value={settings.coins_per_ad} onChange={e => setSettings({ ...settings, coins_per_ad: e.target.value })} />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Coin Expiry (Days)</label>
              <input type="number" className="form-input" style={{ background: '#0f172a', border: '1px solid #334155', color: '#ffffff' }} value={settings.coin_expiry_days} onChange={e => setSettings({ ...settings, coin_expiry_days: e.target.value })} />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Coin Value (INR ₹)</label>
              <input type="number" disabled className="form-input" style={{ background: '#0f172a', border: '1px solid #334155', color: '#a7f3d0', fontWeight: 800 }} value={settings.coin_value_inr} />
            </div>
          </div>
        </div>

        {/* Section 2: Membership Tier Thresholds & Discount Caps */}
        <div style={{ background: '#1e293b', borderRadius: '20px', border: '1px solid #334155', padding: '24px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={20} color="#f59e0b" /> Membership Tiers & Discount Caps
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {levels.map((lvl, index) => (
              <div key={lvl.level_name} style={{ background: '#0f172a', padding: '14px', borderRadius: '12px', border: '1px solid #334155', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', alignItems: 'center' }}>
                <div>
                  <strong style={{ color: '#a5b4fc', fontSize: '14px' }}>{lvl.level_name}</strong>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Tier Name</span>
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8' }}>Min Lifetime Coins</label>
                  <input type="number" className="form-input" style={{ background: '#1e293b', border: '1px solid #334155', color: '#ffffff', padding: '6px 10px', fontSize: '13px' }} value={lvl.min_points} onChange={e => handleLevelChange(index, 'min_points', e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8' }}>Max Discount Cap %</label>
                  <input type="number" className="form-input" style={{ background: '#1e293b', border: '1px solid #334155', color: '#10b981', padding: '6px 10px', fontSize: '13px', fontWeight: 800 }} value={lvl.discount_cap_percent} onChange={e => handleLevelChange(index, 'discount_cap_percent', e.target.value)} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="btn-primary"
          style={{ padding: '16px', fontSize: '15px', background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)' }}
        >
          <Save size={18} /> {saving ? 'Saving...' : 'Save Configuration Changes & Update Economy'}
        </button>
      </form>
    </div>
  );
}
