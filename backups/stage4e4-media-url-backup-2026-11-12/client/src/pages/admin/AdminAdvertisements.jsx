import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import {
  Tv,
  Plus,
  Edit2,
  Trash2,
  Power,
  ExternalLink,
  Eye,
  MousePointer,
  Calendar,
  X,
  RefreshCw,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ShieldCheck
} from 'lucide-react';

export default function AdminAdvertisements() {
  const { token } = useAuth();
  const { t, locale } = useI18n();
  const [activeTab, setActiveTab] = useState('admob'); // 'admob' | 'banners'

  const getStatusLabel = (status) => {
    const normalized = String(status || '').toLowerCase();
    const key = `adminStatusLabel_${normalized}`;
    const label = t(key);
    return label === key ? String(status || '').replace(/_/g, ' ').toUpperCase() : label;
  };

  const getPlacementLabel = (loc) => {
    if (!loc) return '';
    const key = `placement_${loc}`;
    const label = t(key);
    return label === key ? loc.replace(/_/g, ' ') : label;
  };
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [placementFilter, setPlacementFilter] = useState('all');

  // AdMob State
  const [admobData, setAdmobData] = useState(null);
  const [admobLoading, setAdmobLoading] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    banner_url: '',
    destination_url: '',
    display_location: 'home_banner',
    target_category: '',
    start_date: '',
    end_date: '',
    is_active: 1
  });
  const [modalError, setModalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAds = () => {
    setLoading(true);
    let url = '/api/admin/advertisements';
    if (placementFilter !== 'all') url += `?placement=${placementFilter}`;

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(d => { if (d.success) setAds(d.advertisements || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const fetchAdmobData = () => {
    setAdmobLoading(true);
    fetch('/api/admin/advertisements/admob', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(d => { if (d.success) setAdmobData(d); })
      .catch(console.error)
      .finally(() => setAdmobLoading(false));
  };

  useEffect(() => {
    if (!token) return;
    if (activeTab === 'admob') fetchAdmobData();
    else fetchAds();
  }, [token, activeTab, placementFilter]);

  const handleOpenAdd = () => {
    setEditingAd(null);
    setFormData({
      title: '',
      banner_url: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=800&q=80',
      destination_url: '',
      display_location: 'home_banner',
      target_category: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      is_active: 1
    });
    setModalError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (ad) => {
    setEditingAd(ad);
    setFormData({
      title: ad.title,
      banner_url: ad.banner_url,
      destination_url: ad.destination_url || '',
      display_location: ad.display_location,
      target_category: ad.target_category || '',
      start_date: ad.start_date || '',
      end_date: ad.end_date || '',
      is_active: ad.is_active ? 1 : 0
    });
    setModalError('');
    setIsModalOpen(true);
  };

  const handleToggle = async (id) => {
    try {
      const res = await fetch(`/api/admin/advertisements/${id}/toggle`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) fetchAds();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('deleteBannerConfirm'))) return;
    try {
      const res = await fetch(`/api/admin/advertisements/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) fetchAds();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError('');

    const url = editingAd ? `/api/admin/advertisements/${editingAd.id}` : '/api/admin/advertisements';
    const method = editingAd ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsModalOpen(false);
        fetchAds();
      } else {
        setModalError(data.error || t('failedSaveAdErr'));
      }
    } catch (err) {
      setModalError(err.message);
    } finally {
      setIsSubmitting(false);
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
        marginBottom: '20px',
        background: '#0D0D0D',
        border: '1px solid rgba(212, 175, 55, 0.2)',
        borderRadius: '16px',
        padding: '16px 20px'
      }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
            {t('adminAdsTitle')}
          </h1>
          <p style={{ fontSize: '12px', color: '#A0A0A0', margin: '4px 0 0 0' }}>
            {t('adminAdsSub')}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {activeTab === 'admob' ? (
            <button
              type="button"
              onClick={fetchAdmobData}
              style={{
                background: '#181818', border: '1px solid rgba(212, 175, 55, 0.3)',
                color: '#D4AF37', padding: '8px 16px', borderRadius: '10px',
                fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <RefreshCw size={14} className={admobLoading ? 'spin' : ''} /> {t('refreshDiagnosticsBtn')}
            </button>
          ) : (
            <>
              <select
                value={placementFilter}
                onChange={e => setPlacementFilter(e.target.value)}
                style={{
                  background: '#141414', border: '1px solid rgba(212, 175, 55, 0.25)',
                  color: '#FFFFFF', borderRadius: '10px', padding: '8px 12px', fontSize: '12px', outline: 'none'
                }}
              >
                <option value="all">{t('allPlacementsOption')}</option>
                <option value="home_banner">{t('placement_home_banner')}</option>
                <option value="category_banner">{t('placement_category_banner')}</option>
                <option value="shop_banner">{t('placement_shop_banner')}</option>
              </select>

              <button
                type="button"
                onClick={handleOpenAdd}
                style={{
                  background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
                  border: 'none', color: '#050505', padding: '8px 16px', borderRadius: '10px',
                  fontSize: '12px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <Plus size={16} /> {t('createBannerAdBtn')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(212, 175, 55, 0.2)',
        marginBottom: '20px',
        background: '#0D0D0D',
        borderRadius: '12px 12px 0 0',
        padding: '0 12px'
      }}>
        {[
          { id: 'admob', label: t('tabAdmobNativeAds'), icon: Tv },
          { id: 'banners', label: t('tabCommercialBanners'), icon: ImageIcon }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '14px 18px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? '3px solid #D4AF37' : '3px solid transparent',
                color: activeTab === tab.id ? '#F2D675' : '#888',
                fontWeight: activeTab === tab.id ? 800 : 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Icon size={16} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: GOOGLE ADMOB CONFIGURATION & DIAGNOSTICS */}
      {activeTab === 'admob' && (
        <div>
          {/* AdMob 6 Diagnostic Metric Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '14px',
            marginBottom: '24px'
          }}>
            <div style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('totalAdRequestsUpper')}</span>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#3b82f6', marginTop: '4px' }}>
                {(admobData?.stats?.totalRequests || 0).toLocaleString(locale)}
              </div>
              <span style={{ fontSize: '10px', color: '#A0A0A0' }}>{t('clientSdkRequestsSub')}</span>
            </div>

            <div style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('adsLoadedUpper')}</span>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#F2D675', marginTop: '4px' }}>
                {(admobData?.stats?.totalLoaded || 0).toLocaleString(locale)}
              </div>
              <span style={{ fontSize: '10px', color: '#F2D675' }}>{t('availableInventorySub')}</span>
            </div>

            <div style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('confirmedImpressionsUpper')}</span>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#22c55e', marginTop: '4px' }}>
                {(admobData?.stats?.totalImpressions || 0).toLocaleString(locale)}
              </div>
              <span style={{ fontSize: '10px', color: '#22c55e' }}>{t('renderedToCustomersSub')}</span>
            </div>

            <div style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('adClicksUpper')}</span>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#06b6d4', marginTop: '4px' }}>
                {(admobData?.stats?.totalClicks || 0).toLocaleString(locale)}
              </div>
              <span style={{ fontSize: '10px', color: '#06b6d4' }}>{t('customerEngagementsSub')}</span>
            </div>

            <div style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('rewardCompletionsUpper')}</span>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#10b981', marginTop: '4px' }}>
                {(admobData?.stats?.rewardedCompletions || 0).toLocaleString(locale)}
              </div>
              <span style={{ fontSize: '10px', color: '#10b981' }}>{t('rewardedAdWatchesSub')}</span>
            </div>

            <div style={{ background: '#0E0E0E', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '14px', padding: '16px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#A0A0A0' }}>{t('diagnosticErrorsUpper')}</span>
              <div style={{ fontSize: '24px', fontWeight: 900, color: admobData?.stats?.totalErrors > 0 ? '#ef4444' : '#888', marginTop: '4px' }}>
                {(admobData?.stats?.totalErrors || 0).toLocaleString(locale)}
              </div>
              <span style={{ fontSize: '10px', color: '#ef4444' }}>{t('networkNoFillSub')}</span>
            </div>
          </div>

          {/* AdMob SDK Configuration Card */}
          <div style={{
            background: '#0D0D0D',
            border: '1px solid rgba(212, 175, 55, 0.2)',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={20} color="#22c55e" />
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                  {t('googleMobileAdsSdkConfig')}
                </h3>
              </div>
              <span style={{
                padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 800,
                background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)'
              }}>
                {t('sdkStatusBadge', { status: admobData?.config?.status || getStatusLabel('active') })}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              <div style={{ background: '#121212', borderRadius: '10px', padding: '12px 14px', border: '1px solid rgba(212, 175, 55, 0.1)' }}>
                <div style={{ fontSize: '11px', color: '#888', fontWeight: 700 }}>{t('providerUpper')}</div>
                <div style={{ fontSize: '13px', color: '#FFF', fontWeight: 800, marginTop: '2px' }}>
                  {admobData?.config?.provider || 'Google AdMob (Official Mobile Ads SDK)'}
                </div>
              </div>

              <div style={{ background: '#121212', borderRadius: '10px', padding: '12px 14px', border: '1px solid rgba(212, 175, 55, 0.1)' }}>
                <div style={{ fontSize: '11px', color: '#888', fontWeight: 700 }}>{t('activeEnvironmentUpper')}</div>
                <div style={{ fontSize: '13px', color: '#F2D675', fontWeight: 800, marginTop: '2px' }}>
                  {admobData?.config?.environment || 'Development (Official Test Ad Units)'}
                </div>
              </div>

              <div style={{ background: '#121212', borderRadius: '10px', padding: '12px 14px', border: '1px solid rgba(212, 175, 55, 0.1)' }}>
                <div style={{ fontSize: '11px', color: '#888', fontWeight: 700 }}>{t('admobAppIdUpper')}</div>
                <div style={{ fontSize: '12px', color: '#FFF', fontFamily: 'monospace', fontWeight: 700, marginTop: '2px' }}>
                  {admobData?.config?.app_id || 'ca-app-pub-3940256099942544~3347511713'}
                </div>
              </div>

              <div style={{ background: '#121212', borderRadius: '10px', padding: '12px 14px', border: '1px solid rgba(212, 175, 55, 0.1)' }}>
                <div style={{ fontSize: '11px', color: '#888', fontWeight: 700 }}>{t('nativeAdUnitIdUpper')}</div>
                <div style={{ fontSize: '12px', color: '#D4AF37', fontFamily: 'monospace', fontWeight: 700, marginTop: '2px' }}>
                  {admobData?.config?.native_ad_unit_id || 'ca-app-pub-3940256099942544/2247696110'}
                </div>
              </div>

              <div style={{ background: '#121212', borderRadius: '10px', padding: '12px 14px', border: '1px solid rgba(212, 175, 55, 0.1)' }}>
                <div style={{ fontSize: '11px', color: '#888', fontWeight: 700 }}>{t('sessionPlacementsPolicyUpper')}</div>
                <div style={{ fontSize: '13px', color: '#FFF', fontWeight: 700, marginTop: '2px' }}>
                  {t('sessionPlacementsDesc', { count: admobData?.config?.session_placements_count || 3 })}
                </div>
              </div>

              <div style={{ background: '#121212', borderRadius: '10px', padding: '12px 14px', border: '1px solid rgba(212, 175, 55, 0.1)' }}>
                <div style={{ fontSize: '11px', color: '#888', fontWeight: 700 }}>{t('rewardedAdUnitIdUpper')}</div>
                <div style={{ fontSize: '12px', color: '#FFF', fontFamily: 'monospace', fontWeight: 700, marginTop: '2px' }}>
                  {admobData?.config?.rewarded_ad_unit_id || 'ca-app-pub-3940256099942544/5224354917'}
                </div>
              </div>
            </div>
          </div>

          {/* Ad Event Diagnostics Log */}
          <div style={{
            background: '#0D0D0D',
            border: '1px solid rgba(212, 175, 55, 0.2)',
            borderRadius: '16px',
            padding: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                  {t('recentAdDiagnosticsTitle')}
                </h3>
                <span style={{ fontSize: '11px', color: '#A0A0A0' }}>
                  {t('recentAdDiagnosticsSub')}
                </span>
              </div>
              <button
                type="button"
                onClick={fetchAdmobData}
                style={{
                  background: '#1A1A1A', border: '1px solid rgba(212, 175, 55, 0.3)',
                  color: '#D4AF37', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}
              >
                <RefreshCw size={13} /> {t('adminRefreshBtn')}
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#121212', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: '#A0A0A0', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 16px' }}>{t('colLogId')}</th>
                    <th style={{ padding: '12px 16px' }}>{t('colEventType')}</th>
                    <th style={{ padding: '12px 16px' }}>{t('colFormat')}</th>
                    <th style={{ padding: '12px 16px' }}>{t('colAdUnitId')}</th>
                    <th style={{ padding: '12px 16px' }}>{t('colCustomer')}</th>
                    <th style={{ padding: '12px 16px' }}>{t('colDiagnosticMetadata')}</th>
                    <th style={{ padding: '12px 16px' }}>{t('colTimestamp')}</th>
                  </tr>
                </thead>
                <tbody>
                  {admobData?.recentLogs?.length > 0 ? (
                    admobData.recentLogs.map(log => (
                      <tr key={log.id} style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.08)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#D4AF37' }}>#{log.id}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800,
                            background: log.event_type === 'impression' ? 'rgba(34, 197, 94, 0.15)' :
                                        log.event_type === 'click' ? 'rgba(6, 182, 212, 0.15)' :
                                        log.event_type === 'loaded' ? 'rgba(242, 214, 117, 0.15)' :
                                        log.event_type === 'reward_completed' ? 'rgba(16, 185, 129, 0.15)' :
                                        log.event_type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(100, 100, 100, 0.15)',
                            color: log.event_type === 'impression' ? '#22c55e' :
                                   log.event_type === 'click' ? '#06b6d4' :
                                   log.event_type === 'loaded' ? '#F2D675' :
                                   log.event_type === 'reward_completed' ? '#10b981' :
                                   log.event_type === 'error' ? '#ef4444' : '#888'
                          }}>
                            {log.event_type?.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#FFFFFF', fontSize: '12px' }}>
                          {log.ad_format}
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '11px', color: '#A0A0A0' }}>
                          {log.ad_unit_id || '—'}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#FFFFFF' }}>
                          {log.user_name || (log.user_id ? t('userFallbackLabel', { id: log.user_id }) : t('guestLabel'))}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '11px', color: '#888', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.metadata || '—'}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '11px', color: '#888' }}>
                          {new Date(log.created_at).toLocaleString(locale)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: '#888' }}>
                        {t('noDiagnosticEvents')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PROMOTIONAL IN-APP BANNERS */}
      {activeTab === 'banners' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '18px'
        }}>
        {ads.map(ad => (
          <div
            key={ad.id}
            style={{
              background: '#0E0E0E',
              border: ad.is_active ? '1px solid rgba(212, 175, 55, 0.3)' : '1px solid #222',
              borderRadius: '16px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
            }}
          >
            {/* Banner Preview */}
            <div style={{ height: '140px', position: 'relative', background: '#181818' }}>
              <img
                src={ad.banner_url}
                alt={ad.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => { e.target.src = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=800&q=80'; }}
              />
              <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                <span style={{
                  padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800,
                  background: ad.is_active ? 'rgba(34, 197, 94, 0.9)' : 'rgba(0,0,0,0.8)',
                  color: '#FFF'
                }}>
                  {ad.is_active ? getStatusLabel('active') : getStatusLabel('inactive')}
                </span>
              </div>
            </div>

            {/* Banner Content */}
            <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#D4AF37', textTransform: 'uppercase' }}>
                    {getPlacementLabel(ad.display_location)}
                  </span>
                  <span style={{ fontSize: '10px', color: '#888' }}>
                    #{ad.id}
                  </span>
                </div>

                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 8px 0' }}>
                  {ad.title}
                </h3>

                {ad.destination_url && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#A0A0A0', marginBottom: '10px' }}>
                    <ExternalLink size={12} color="#D4AF37" />
                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {ad.destination_url}
                    </span>
                  </div>
                )}

                {/* Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: '#141414', padding: '8px 12px', borderRadius: '8px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Eye size={13} color="#3b82f6" />
                    <span style={{ fontSize: '11px', color: '#FFF', fontWeight: 700 }}>{t('viewsCountLabel', { count: ad.impressions_count || 0 })}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MousePointer size={13} color="#22c55e" />
                    <span style={{ fontSize: '11px', color: '#FFF', fontWeight: 700 }}>{t('clicksCountLabel', { count: ad.clicks_count || 0 })}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => handleToggle(ad.id)}
                  style={{
                    flex: 1, padding: '6px', borderRadius: '8px',
                    background: ad.is_active ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                    border: `1px solid ${ad.is_active ? '#ef4444' : '#22c55e'}`,
                    color: ad.is_active ? '#ef4444' : '#22c55e', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                  }}
                >
                  <Power size={12} /> {ad.is_active ? t('adminDeactivateBtn') : t('adminActivateBtn')}
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenEdit(ad)}
                  style={{
                    padding: '6px 12px', borderRadius: '8px', background: '#181818',
                    border: '1px solid rgba(212, 175, 55, 0.3)', color: '#F2D675', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  <Edit2 size={12} /> {t('adminEditBtn')}
                </button>

                <button
                  type="button"
                  aria-label={t('adminDeleteBtn')}
                  title={t('adminDeleteBtn')}
                  onClick={() => handleDelete(ad.id)}
                  style={{
                    padding: '6px 10px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid #ef4444', color: '#ef4444', fontSize: '11px', cursor: 'pointer'
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div role="dialog" aria-modal="true" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#0E0E0E', border: '1px solid #D4AF37', borderRadius: '16px',
            width: '480px', maxWidth: '100%', padding: '24px', boxShadow: '0 16px 40px rgba(0,0,0,0.9)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                {editingAd ? t('editBannerAdTitle') : t('createBannerAdTitle')}
              </h3>
              <button type="button" aria-label={t('closeModalAria')} onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', color: '#ef4444', fontSize: '12px', marginBottom: '14px' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                  {t('adTitleRequired')}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('adTitlePlaceholder')}
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  style={{
                    width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                    borderRadius: '8px', padding: '8px 12px', color: '#FFFFFF', fontSize: '13px', outline: 'none'
                  }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                  {t('bannerImageUrlRequired')}
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://..."
                  value={formData.banner_url}
                  onChange={e => setFormData({ ...formData, banner_url: e.target.value })}
                  style={{
                    width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                    borderRadius: '8px', padding: '8px 12px', color: '#FFFFFF', fontSize: '13px', outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                    {t('displayPlacementRequired')}
                  </label>
                  <select
                    value={formData.display_location}
                    onChange={e => setFormData({ ...formData, display_location: e.target.value })}
                    style={{
                      width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                      borderRadius: '8px', padding: '8px 12px', color: '#FFFFFF', fontSize: '13px', outline: 'none'
                    }}
                  >
                    <option value="home_banner">{t('placementFull_home_banner')}</option>
                    <option value="category_banner">{t('placementFull_category_banner')}</option>
                    <option value="shop_banner">{t('placementFull_shop_banner')}</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                    {t('destinationUrlLabel')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('destinationUrlPlaceholder')}
                    value={formData.destination_url}
                    onChange={e => setFormData({ ...formData, destination_url: e.target.value })}
                    style={{
                      width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                      borderRadius: '8px', padding: '8px 12px', color: '#FFFFFF', fontSize: '13px', outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                    {t('startDateLabel')}
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                    style={{
                      width: '100%', background: '#141414', border: '1px solid rgba(212, 175, 55, 0.3)',
                      borderRadius: '8px', padding: '8px 12px', color: '#FFFFFF', fontSize: '13px', outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '4px' }}>
                    {t('endDateLabel')}
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={e => setFormData({ ...formData, end_date: e.target.value })}
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
                  onClick={() => setIsModalOpen(false)}
                  style={{ padding: '8px 14px', borderRadius: '8px', background: '#1A1A1A', border: '1px solid #333', color: '#888', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  {t('cancelBtn')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '8px 18px', borderRadius: '8px',
                    background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
                    border: 'none', color: '#050505', fontSize: '12px', fontWeight: 900, cursor: 'pointer'
                  }}
                >
                  {isSubmitting ? t('adminSavingProgress') : editingAd ? t('updateBannerBtn') : t('createBannerBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
