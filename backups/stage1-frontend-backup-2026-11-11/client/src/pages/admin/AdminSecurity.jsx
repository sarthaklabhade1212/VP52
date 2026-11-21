import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldAlert,
  Shield,
  Users,
  Database,
  History,
  AlertTriangle,
  Plus,
  Power,
  RefreshCw,
  CheckCircle2,
  X,
  Lock,
  Download,
  Search,
  Key,
  ShieldCheck,
  FileCheck
} from 'lucide-react';

export default function AdminSecurity() {
  const { token, user: currentAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('admins'); // admins, logs, backups, fraud
  const [loading, setLoading] = useState(true);

  // Tab 1: Admins State
  const [admins, setAdmins] = useState([]);
  const [isAddAdminOpen, setIsAddAdminOpen] = useState(false);
  const [adminFormData, setAdminFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'operations_admin',
    permissions: ['dashboard:view', 'merchants:view', 'customers:view']
  });
  const [adminError, setAdminError] = useState('');
  const [isSubmittingAdmin, setIsSubmittingAdmin] = useState(false);

  // Tab 2: Activity Logs State
  const [logs, setLogs] = useState([]);
  const [logSearch, setLogSearch] = useState('');

  // Tab 3: Backups State
  const [backups, setBackups] = useState([]);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [backupVerifyResult, setBackupVerifyResult] = useState(null);

  // Tab 4: Fraud Alerts State
  const [fraudAlerts, setFraudAlerts] = useState([]);
  const [isScanningFraud, setIsScanningFraud] = useState(false);
  const [fraudScanMessage, setFraudScanMessage] = useState('');

  const fetchAdmins = () => {
    setLoading(true);
    fetch('/api/admin/admins', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(d => { if (d.success) setAdmins(d.admins || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const fetchLogs = () => {
    setLoading(true);
    fetch('/api/admin/activity-logs?limit=100', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(d => { if (d.success) setLogs(d.logs || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const fetchBackups = () => {
    setLoading(true);
    fetch('/api/admin/backups', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(d => { if (d.success) setBackups(d.backups || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const fetchFraudAlerts = () => {
    setLoading(true);
    fetch('/api/admin/fraud/alerts', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(d => { if (d.success) setFraudAlerts(d.alerts || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!token) return;
    if (activeTab === 'admins') fetchAdmins();
    else if (activeTab === 'logs') fetchLogs();
    else if (activeTab === 'backups') fetchBackups();
    else if (activeTab === 'fraud') fetchFraudAlerts();
  }, [token, activeTab]);

  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    try {
      const res = await fetch('/api/admin/backups/create', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`Backup snapshot created successfully: ${data.filename} (Integrity: ${data.integrity})`);
        fetchBackups();
      } else {
        alert(data.error || 'Failed to create backup');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleVerifyBackup = async (filename) => {
    try {
      const res = await fetch(`/api/admin/backups/verify/${filename}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`Snapshot ${filename} verified. SQLite integrity check: ${data.integrity.toUpperCase()}`);
      } else {
        alert(data.error || 'Verification failed');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRunFraudScan = async () => {
    setIsScanningFraud(true);
    setFraudScanMessage('');
    try {
      const res = await fetch('/api/admin/fraud/scan', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFraudScanMessage(data.message);
        fetchFraudAlerts();
      } else {
        alert(data.error || 'Scan failed');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIsScanningFraud(false);
    }
  };

  const handleToggleAdminStatus = async (adminId) => {
    if (adminId === currentAdmin?.id) {
      alert('Security Protection: You cannot deactivate your own active admin account.');
      return;
    }
    if (!window.confirm('Toggle status for this admin account?')) return;

    try {
      const res = await fetch(`/api/admin/admins/${adminId}/deactivate`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchAdmins();
      } else {
        alert(data.error || 'Failed to update admin status');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddAdminSubmit = async (e) => {
    e.preventDefault();
    setAdminError('');
    setIsSubmittingAdmin(true);

    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(adminFormData)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsAddAdminOpen(false);
        fetchAdmins();
      } else {
        setAdminError(data.error || 'Failed to create admin');
      }
    } catch (err) {
      setAdminError(err.message);
    } finally {
      setIsSubmittingAdmin(false);
    }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '24px',
        background: '#0D0D0D',
        border: '1px solid rgba(212, 175, 55, 0.2)',
        borderRadius: '16px',
        padding: '16px 20px'
      }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
            Admin & Security Settings
          </h1>
          <p style={{ fontSize: '12px', color: '#A0A0A0', margin: '4px 0 0 0' }}>
            RBAC role-based access control, activity audit logs, database snapshots & fraud monitoring
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '6px', background: '#141414', padding: '4px', borderRadius: '10px', border: '1px solid rgba(212, 175, 55, 0.2)', flexWrap: 'wrap' }}>
          {[
            { id: 'admins', label: 'Admin Accounts', icon: Users },
            { id: 'logs', label: 'Activity Logs', icon: History },
            { id: 'backups', label: 'Database Backups', icon: Database },
            { id: 'fraud', label: 'Fraud Detection', icon: ShieldAlert },
          ].map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  background: activeTab === t.id ? 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)' : 'transparent',
                  color: activeTab === t.id ? '#050505' : '#A0A0A0',
                  border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: ADMIN ACCOUNTS & RBAC */}
      {activeTab === 'admins' && (
        <div style={{ background: '#0D0D0D', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                Registered Platform Administrators ({admins.length})
              </h3>
              <span style={{ fontSize: '11px', color: '#A0A0A0' }}>Granular role-based permissions access</span>
            </div>

            <button
              onClick={() => {
                setAdminFormData({
                  name: '',
                  email: '',
                  phone: '',
                  password: '',
                  role: 'operations_admin',
                  permissions: ['dashboard:view', 'merchants:view', 'customers:view']
                });
                setAdminError('');
                setIsAddAdminOpen(true);
              }}
              style={{
                background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
                border: 'none', color: '#050505', padding: '8px 16px', borderRadius: '10px',
                fontSize: '12px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <Plus size={15} /> Add Administrator
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#121212', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#A0A0A0', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Admin User</th>
                  <th style={{ padding: '12px 16px' }}>Phone</th>
                  <th style={{ padding: '12px 16px' }}>Role</th>
                  <th style={{ padding: '12px 16px' }}>Permissions</th>
                  <th style={{ padding: '12px 16px' }}>Last Login</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map(a => (
                  <tr key={a.id} style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.08)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#FFF' }}>{a.full_name}</div>
                      <div style={{ fontSize: '10px', color: '#888' }}>{a.email}</div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#C0C0C0' }}>
                      {a.phone || '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase',
                        background: a.role === 'super_admin' ? 'rgba(212, 175, 55, 0.2)' : 'rgba(59, 130, 246, 0.15)',
                        color: a.role === 'super_admin' ? '#F2D675' : '#3b82f6',
                        border: `1px solid ${a.role === 'super_admin' ? '#D4AF37' : '#3b82f6'}`
                      }}>
                        {a.role?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '11px', color: '#888', maxWidth: '200px' }}>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                        {typeof a.permissions === 'string' ? a.permissions : JSON.stringify(a.permissions)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '11px', color: '#888' }}>
                      {a.last_login_at ? new Date(a.last_login_at).toLocaleString() : 'Never'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800,
                        background: a.status === 'active' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: a.status === 'active' ? '#22c55e' : '#ef4444'
                      }}>
                        {a.status?.toUpperCase() || 'ACTIVE'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {a.id !== currentAdmin?.id && (
                        <button
                          onClick={() => handleToggleAdminStatus(a.id)}
                          style={{
                            padding: '4px 8px', borderRadius: '6px',
                            background: a.status === 'active' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                            border: `1px solid ${a.status === 'active' ? '#ef4444' : '#22c55e'}`,
                            color: a.status === 'active' ? '#ef4444' : '#22c55e', fontSize: '11px', fontWeight: 700, cursor: 'pointer'
                          }}
                        >
                          {a.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: SYSTEM ACTIVITY & AUDIT LOGS */}
      {activeTab === 'logs' && (
        <div style={{ background: '#0D0D0D', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                Real-Time Administrator Activity Trail
              </h3>
              <span style={{ fontSize: '11px', color: '#A0A0A0' }}>
                Immutable logging of all admin actions, approvals, coin adjustments and updates
              </span>
            </div>
            <button onClick={fetchLogs} style={{ background: '#1A1A1A', border: '1px solid rgba(212, 175, 55, 0.3)', color: '#D4AF37', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
              Refresh Logs
            </button>
          </div>

          <div style={{ overflowX: 'auto', maxHeight: '520px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#121212', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#A0A0A0', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 14px' }}>Log ID</th>
                  <th style={{ padding: '12px 14px' }}>Admin</th>
                  <th style={{ padding: '12px 14px' }}>Module</th>
                  <th style={{ padding: '12px 14px' }}>Action</th>
                  <th style={{ padding: '12px 14px' }}>Target ID</th>
                  <th style={{ padding: '12px 14px' }}>Details / Diff</th>
                  <th style={{ padding: '12px 14px' }}>IP Address</th>
                  <th style={{ padding: '12px 14px' }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id} style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.08)' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#D4AF37' }}>#{l.id}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#FFF' }}>{l.admin_name || `Admin #${l.admin_id}`}</td>
                    <td style={{ padding: '10px 14px', color: '#F2D675', fontWeight: 600 }}>{l.module}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 800, color: '#FFF' }}>{l.action_type}</td>
                    <td style={{ padding: '10px 14px', color: '#A0A0A0' }}>{l.target_id || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#888', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.details || '—'}
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#666' }}>{l.ip_address || '127.0.0.1'}</td>
                    <td style={{ padding: '10px 14px', color: '#888' }}>{new Date(l.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: DATABASE BACKUP & SNAPSHOTS */}
      {activeTab === 'backups' && (
        <div style={{ background: '#0D0D0D', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                Online Database Backups (SQLite Backup API)
              </h3>
              <span style={{ fontSize: '11px', color: '#A0A0A0' }}>
                Instant live WAL snapshots with zero disruption and automatic integrity verification
              </span>
            </div>

            <button
              onClick={handleCreateBackup}
              disabled={isCreatingBackup}
              style={{
                background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
                border: 'none', color: '#050505', padding: '8px 16px', borderRadius: '10px',
                fontSize: '12px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <Database size={15} />
              {isCreatingBackup ? 'Creating Snapshot...' : 'Create Live Backup Snapshot'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {backups.map((b, idx) => (
              <div
                key={idx}
                style={{
                  padding: '14px 18px', background: '#121212', borderRadius: '12px',
                  border: '1px solid rgba(212, 175, 55, 0.15)', display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileCheck size={16} color="#D4AF37" />
                    <span style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '13px' }}>{b.filename}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                    Created: {new Date(b.created_at).toLocaleString()} • Size: {(b.size / 1024).toFixed(1)} KB
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleVerifyBackup(b.filename)}
                    style={{
                      padding: '6px 12px', borderRadius: '8px', background: 'rgba(34, 197, 94, 0.15)',
                      border: '1px solid #22c55e', color: '#22c55e', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '4px'
                    }}
                  >
                    <CheckCircle2 size={13} /> Verify PRAGMA Integrity
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: HEURISTIC FRAUD DETECTION */}
      {activeTab === 'fraud' && (
        <div style={{ background: '#0D0D0D', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                Heuristic Fraud & Abuse Alerts
              </h3>
              <span style={{ fontSize: '11px', color: '#A0A0A0' }}>
                {'Automated detection of duplicate phones, rapid coin velocity (>250 in 24h) & referral bot patterns'}
              </span>
            </div>

            <button
              onClick={handleRunFraudScan}
              disabled={isScanningFraud}
              style={{
                background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
                border: 'none', color: '#FFFFFF', padding: '8px 16px', borderRadius: '10px',
                fontSize: '12px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <ShieldAlert size={15} />
              {isScanningFraud ? 'Running Scanner...' : 'Run Security Scan'}
            </button>
          </div>

          {fraudScanMessage && (
            <div style={{ padding: '10px 14px', background: 'rgba(212, 175, 55, 0.15)', border: '1px solid #D4AF37', borderRadius: '8px', color: '#F2D675', fontSize: '12px', marginBottom: '16px' }}>
              {fraudScanMessage}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {fraudAlerts.length > 0 ? (
              fraudAlerts.map(a => (
                <div
                  key={a.id}
                  style={{
                    padding: '14px', background: '#141414', borderRadius: '12px',
                    border: '1px solid rgba(239, 68, 68, 0.3)', display: 'flex',
                    justifyContent: 'space-between', alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertTriangle size={16} color="#ef4444" />
                      <span style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '13px' }}>
                        {a.alert_type?.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      <span style={{
                        padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 800,
                        background: a.severity === 'high' ? '#ef4444' : '#f97316', color: '#FFF'
                      }}>
                        {a.severity}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#C0C0C0', marginTop: '4px' }}>
                      {a.details}
                    </div>
                  </div>

                  <span style={{
                    padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 800,
                    background: a.status === 'pending_review' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                    color: a.status === 'pending_review' ? '#eab308' : '#22c55e'
                  }}>
                    {a.status?.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: '#888', fontSize: '13px' }}>
                <CheckCircle2 size={32} color="#22c55e" style={{ margin: '0 auto 12px' }} />
                <div>Zero security anomalies or fraud alerts detected!</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Administrator Modal */}
      {isAddAdminOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#0E0E0E', border: '1px solid #D4AF37', borderRadius: '16px',
            width: '460px', maxWidth: '100%', padding: '24px', boxShadow: '0 16px 40px rgba(0,0,0,0.9)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>Add Administrator Account</h3>
              <button onClick={() => setIsAddAdminOpen(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {adminError && (
              <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', color: '#ef4444', fontSize: '12px', marginBottom: '14px' }}>
                {adminError}
              </div>
            )}

            <form onSubmit={handleAddAdminSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Patil"
                  value={adminFormData.name}
                  onChange={e => setAdminFormData({ ...adminFormData, name: e.target.value })}
                  style={{
                    width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                    borderRadius: '8px', padding: '8px 12px', color: '#FFFFFF', fontSize: '13px', outline: 'none'
                  }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. rahul.vp52@gmail.com"
                  value={adminFormData.email}
                  onChange={e => setAdminFormData({ ...adminFormData, email: e.target.value })}
                  style={{
                    width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                    borderRadius: '8px', padding: '8px 12px', color: '#FFFFFF', fontSize: '13px', outline: 'none'
                  }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                  Mobile Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={adminFormData.phone}
                  onChange={e => setAdminFormData({ ...adminFormData, phone: e.target.value })}
                  style={{
                    width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                    borderRadius: '8px', padding: '8px 12px', color: '#FFFFFF', fontSize: '13px', outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                    Admin Role *
                  </label>
                  <select
                    value={adminFormData.role}
                    onChange={e => setAdminFormData({ ...adminFormData, role: e.target.value })}
                    style={{
                      width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                      borderRadius: '8px', padding: '8px 10px', color: '#FFFFFF', fontSize: '12px', outline: 'none'
                    }}
                  >
                    <option value="super_admin">Super Admin</option>
                    <option value="finance_admin">Finance Admin</option>
                    <option value="support_admin">Support Admin</option>
                    <option value="operations_admin">Operations Admin</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Min 8 characters"
                    value={adminFormData.password}
                    onChange={e => setAdminFormData({ ...adminFormData, password: e.target.value })}
                    style={{
                      width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                      borderRadius: '8px', padding: '8px 12px', color: '#FFFFFF', fontSize: '13px', outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setIsAddAdminOpen(false)}
                  style={{ padding: '8px 14px', borderRadius: '8px', background: '#1A1A1A', border: '1px solid #333', color: '#888', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdmin}
                  style={{
                    padding: '8px 18px', borderRadius: '8px',
                    background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
                    border: 'none', color: '#050505', fontSize: '12px', fontWeight: 900, cursor: 'pointer'
                  }}
                >
                  {isSubmittingAdmin ? 'Creating...' : 'Create Admin Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
