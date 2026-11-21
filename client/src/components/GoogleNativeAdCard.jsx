import React, { useEffect, useRef } from 'react';
import { ExternalLink, Star } from 'lucide-react';
import { logAdEvent } from '../services/admobService';
import { useI18n } from '../i18n/I18nContext';

export default function GoogleNativeAdCard({ ad, token, index = 0 }) {
  const { t } = useI18n();
  const impressionLoggedRef = useRef(false);

  useEffect(() => {
    if (!impressionLoggedRef.current && ad) {
      impressionLoggedRef.current = true;
      logAdEvent(token, {
        ad_format: 'native',
        event_type: 'impression',
        ad_unit_id: ad.adUnitId,
        metadata: { ad_id: ad.id, slot_index: index, headline: ad.headline }
      });
    }
  }, [ad, token, index]);

  if (!ad) return null;

  const handleClick = () => {
    logAdEvent(token, {
      ad_format: 'native',
      event_type: 'click',
      ad_unit_id: ad.adUnitId,
      metadata: { ad_id: ad.id, headline: ad.headline }
    });
  };

  return (
    <div
      style={{
        background: '#151515',
        border: '1px solid rgba(212, 175, 55, 0.25)',
        borderRadius: '16px',
        padding: '14px',
        marginBottom: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)'
      }}
    >
      {/* Google Attribution Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              background: '#D4AF37',
              color: '#050505',
              fontSize: '10px',
              fontWeight: 900,
              padding: '2px 6px',
              borderRadius: '4px',
              letterSpacing: '0.5px',
              textTransform: 'uppercase'
            }}
          >
            {t('nativeAdBadge')}
          </span>
          <span style={{ fontSize: '11px', color: '#B8B8B8', fontWeight: 600 }}>
            {ad.advertiser || t('googleSponsoredFallback')}
          </span>
        </div>

        {ad.starRating && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <Star size={12} color="#F2D675" fill="#F2D675" />
            <span style={{ fontSize: '11px', color: '#F2D675', fontWeight: 700 }}>
              {ad.starRating}
            </span>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        {ad.iconUrl && (
          <img
            src={ad.iconUrl}
            alt={ad.headline}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '10px',
              objectFit: 'cover',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              flexShrink: 0
            }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4
            style={{
              fontSize: '14px',
              fontWeight: 800,
              color: '#FFFFFF',
              margin: '0 0 3px 0',
              lineHeight: 1.25
            }}
          >
            {ad.headline}
          </h4>
          <p
            style={{
              fontSize: '11px',
              color: '#A0A0A0',
              margin: 0,
              lineHeight: 1.35,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            {ad.body}
          </p>
        </div>
      </div>

      {/* Optional Large Image Asset */}
      {ad.imageUrl && (
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '110px',
            borderRadius: '10px',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}
        >
          <img
            src={ad.imageUrl}
            alt={ad.headline}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      )}

      {/* CTA Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
        <span style={{ fontSize: '11px', color: '#B8B8B8', fontStyle: 'italic' }}>
          {ad.store || t('admobNativeUnit')}
        </span>
        <button
          onClick={handleClick}
          style={{
            background: 'linear-gradient(135deg, #F2D675 0%, #D4AF37 100%)',
            color: '#050505',
            border: 'none',
            borderRadius: '8px',
            padding: '7px 16px',
            fontSize: '12px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span>{ad.callToAction || t('learnMoreBtn')}</span>
          <ExternalLink size={12} color="#050505" />
        </button>
      </div>
    </div>
  );
}
