import React, { useState, useRef } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { useI18n } from '../i18n/I18nContext';
import {
  QrCode,
  Download,
  Share2,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Store,
  ShieldCheck,
  Copy,
  Check,
  X
} from 'lucide-react';

export default function MerchantPermanentQrCard({ shop, onRefresh }) {
  const { t, translateCategory } = useI18n();
  const [copied, setCopied] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const qrCanvasRef = useRef(null);

  if (!shop) return null;

  const qrPayload = shop.qr_string || `VP52:MERCHANT:${shop.permanent_qr_code}`;
  const qrStatus = shop.qr_status || 'active';
  const isActive = shop.status === 'active' && qrStatus === 'active';
  const displayCategory = shop.category ? translateCategory(shop.category) : t('retailFallback');
  const displayCategoryLocal = shop.category ? translateCategory(shop.category) : t('localShopFallback');
  const displayShopCode = shop.shop_code || `SHOP-${shop.id}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(shop.permanent_qr_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadPNG = () => {
    const canvas = qrCanvasRef.current?.querySelector('canvas');
    if (!canvas) return;

    // Create high-res branded export canvas
    const exportCanvas = document.createElement('canvas');
    const ctx = exportCanvas.getContext('2d');
    const width = 800;
    const height = 1000;
    exportCanvas.width = width;
    exportCanvas.height = height;

    // Background
    ctx.fillStyle = '#0B0B0B';
    ctx.fillRect(0, 0, width, height);

    // Golden border
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 12;
    ctx.strokeRect(20, 20, width - 40, height - 40);

    // Header branding (with Devanagari-capable font + maxWidth containment)
    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 34px "Noto Sans Devanagari", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t('posterBrandHeader'), width / 2, 80, width - 90);

    ctx.fillStyle = '#F2D675';
    ctx.font = '22px "Noto Sans Devanagari", sans-serif';
    ctx.fillText(t('posterScanPayHeadline'), width / 2, 120, width - 90);

    // Coin-only rewards badge
    ctx.fillStyle = '#1A1A1A';
    ctx.fillRect(80, 145, 640, 46);
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 2;
    ctx.strokeRect(80, 145, 640, 46);

    ctx.fillStyle = '#22C55E';
    ctx.font = 'bold 20px "Noto Sans Devanagari", sans-serif';
    ctx.fillText(t('posterCoinBadge'), width / 2, 175, 610);

    // Draw QR code from canvas
    const qrSize = 420;
    const qrX = (width - qrSize) / 2;
    const qrY = 220;

    // White background for QR code for optimal scanning
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(qrX - 16, qrY - 16, qrSize + 32, qrSize + 32);
    ctx.drawImage(canvas, qrX, qrY, qrSize, qrSize);

    // Shop Details
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 34px "Noto Sans Devanagari", sans-serif';
    ctx.fillText(shop.name, width / 2, 700, width - 90);

    ctx.fillStyle = '#A0A0A0';
    ctx.font = '20px "Noto Sans Devanagari", sans-serif';
    ctx.fillText(
      t('posterCategoryIdLine', { category: displayCategoryLocal, id: displayShopCode }),
      width / 2,
      740,
      width - 90
    );

    if (shop.address) {
      ctx.fillStyle = '#888888';
      ctx.font = '16px "Noto Sans Devanagari", sans-serif';
      const addressText = shop.address.length > 55 ? shop.address.substring(0, 52) + '...' : shop.address;
      ctx.fillText(addressText, width / 2, 775, width - 90);
    }

    // Step-by-step footer guide
    ctx.fillStyle = '#141414';
    ctx.fillRect(60, 810, 680, 120);
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(60, 810, 680, 120);

    ctx.fillStyle = '#F2D675';
    ctx.font = 'bold 17px "Noto Sans Devanagari", sans-serif';
    ctx.fillText(t('posterHowCustomersPay'), width / 2, 840, 650);

    ctx.fillStyle = '#E0E0E0';
    ctx.font = '15px "Noto Sans Devanagari", sans-serif';
    ctx.fillText(t('posterStepByStepGuide'), width / 2, 880, 650);

    ctx.fillStyle = '#22C55E';
    ctx.font = '14px "Noto Sans Devanagari", sans-serif';
    ctx.fillText(t('posterVerifiedFooter'), width / 2, 915, 650);

    // Trigger PNG download
    const link = document.createElement('a');
    link.download = `VP52-Merchant-QR-${shop.shop_code || shop.id}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: t('shareQrTitle', { name: shop.name }),
          text: t('shareQrText', { name: shop.name, code: shop.permanent_qr_code }),
          url: window.location.origin
        });
      } catch (err) {
        if (err.name !== 'AbortError') handleCopyCode();
      }
    } else {
      handleCopyCode();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <div style={{
        background: 'linear-gradient(135deg, #101010 0%, #17150C 100%)',
        border: '1px solid rgba(212, 175, 55, 0.35)',
        borderRadius: '20px',
        padding: '24px',
        boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Header Ribbon */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px',
          borderBottom: '1px solid rgba(212, 175, 55, 0.15)',
          paddingBottom: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#050505',
              boxShadow: '0 4px 14px rgba(212, 175, 55, 0.3)'
            }}>
              <QrCode size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
                  {t('myPermanentQrTitle')}
                </h2>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '10px',
                  fontWeight: 800,
                  background: isActive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: isActive ? '#22c55e' : '#ef4444',
                  border: `1px solid ${isActive ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                }}>
                  {isActive ? t('activeAcceptingCoinsBadge') : qrStatus.toUpperCase()}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#A0A0A0', margin: '4px 0 0 0' }}>
                {t('staticCounterQrSubtitle')}
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleDownloadPNG}
              style={{
                background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
                color: '#050505',
                border: 'none',
                borderRadius: '10px',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Download size={14} aria-hidden="true" /> {t('downloadPngBtn')}
            </button>

            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              style={{
                background: '#1A1A1A',
                color: '#F2D675',
                border: '1px solid rgba(212, 175, 55, 0.3)',
                borderRadius: '10px',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Printer size={14} aria-hidden="true" /> {t('printPosterBtn')}
            </button>

            <button
              type="button"
              onClick={handleShare}
              style={{
                background: '#1A1A1A',
                color: '#FFFFFF',
                border: '1px solid #333',
                borderRadius: '10px',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Share2 size={14} aria-hidden="true" /> {t('shareBtn')}
            </button>
          </div>
        </div>

        {/* QR Core Showcase */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
          alignItems: 'center'
        }}>
          {/* QR Code Container */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#080808',
            border: '2px dashed rgba(212, 175, 55, 0.35)',
            borderRadius: '18px',
            padding: '24px'
          }}>
            {/* White canvas backing for optimal optical scan contrast */}
            <div
              ref={qrCanvasRef}
              style={{
                background: '#FFFFFF',
                padding: '16px',
                borderRadius: '16px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <QRCodeCanvas
                value={qrPayload}
                size={220}
                level="H"
                includeMargin={false}
              />
            </div>

            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#141414',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(212, 175, 55, 0.2)'
              }}>
                <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#D4AF37', fontWeight: 800 }}>
                  {shop.permanent_qr_code}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  title={t('copyQrCodeAria')}
                  aria-label={t('copyQrCodeAria')}
                  style={{ background: 'none', border: 'none', color: copied ? '#22c55e' : '#888', cursor: 'pointer', padding: '2px', display: 'flex' }}
                >
                  {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                </button>
              </div>
              <div style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>
                {t('permanentIdNeverExpires')}
              </div>
            </div>
          </div>

          {/* Shop Details & Counter Standee Info */}
          <div>
            <div style={{
              background: '#0E0E0E',
              border: '1px solid rgba(212, 175, 55, 0.2)',
              borderRadius: '14px',
              padding: '18px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <Store size={18} color="#D4AF37" />
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                  {shop.name}
                </h3>
              </div>
              <div style={{ fontSize: '12px', color: '#A0A0A0', marginBottom: '4px' }}>
                {t('merchantIdColon')} <span style={{ color: '#FFFFFF', fontWeight: 700 }}>{displayShopCode}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#A0A0A0', marginBottom: '4px' }}>
                {t('categoryColon')} <span style={{ color: '#F2D675', fontWeight: 700 }}>{displayCategory}</span>
              </div>
              {shop.address && (
                <div style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>
                  {shop.address}
                </div>
              )}
            </div>

            {/* Invariant & Counter Standee Instructions */}
            <div style={{
              background: 'rgba(212, 175, 55, 0.05)',
              border: '1px solid rgba(212, 175, 55, 0.2)',
              borderRadius: '14px',
              padding: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <CheckCircle2 size={16} color="#22c55e" />
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#F2D675' }}>
                  {t('howMerchantQrWorksTitle')}
                </span>
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '11px', color: '#B0B0B0', lineHeight: 1.7 }}>
                <li>{t('howMerchantQrStep1')}</li>
                <li>{t('howMerchantQrStep2')}</li>
                <li>{t('howMerchantQrStep3')}</li>
                <li>{t('howMerchantQrStep4')}</li>
                <li>{t('howMerchantQrStep5')}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Printable Counter Standee Poster Modal */}
      {showPrintModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('printPosterModalTitle')}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 1200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div style={{
            background: '#0E0E0E',
            border: '2px solid #D4AF37',
            borderRadius: '20px',
            width: '600px',
            maxWidth: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.95)',
            position: 'relative'
          }}>
            {/* Modal Header Controls */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #222', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Printer size={18} color="#D4AF37" aria-hidden="true" />
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#FFF', margin: 0 }}>
                  {t('printPosterModalTitle')}
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handlePrint}
                  style={{
                    background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
                    color: '#050505',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Printer size={14} aria-hidden="true" /> {t('printNowBtn')}
                </button>
                <button
                  type="button"
                  aria-label={t('closeBtn')}
                  onClick={() => setShowPrintModal(false)}
                  style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Standee Sheet (A4 Proportion) */}
            <div id="vp52-counter-poster" style={{
              background: '#FFFFFF',
              color: '#000000',
              borderRadius: '16px',
              padding: '32px 24px',
              textAlign: 'center',
              border: '6px solid #D4AF37'
            }}>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#000000', letterSpacing: '1px' }}>
                VP52
              </div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#997300', textTransform: 'uppercase', marginBottom: '14px' }}>
                {t('oneAppAllShopsServices')}
              </div>

              <div style={{
                background: '#000000',
                color: '#FFFFFF',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 900,
                display: 'inline-block',
                marginBottom: '20px'
              }}>
                {t('posterPayWithCoinsHere')}
              </div>

              <div style={{ fontSize: '14px', color: '#16a34a', fontWeight: 800, marginBottom: '20px' }}>
                {t('posterCoinRewardsSubtitle')}
              </div>

              {/* Big High-Contrast QR Code */}
              <div style={{
                display: 'inline-block',
                padding: '16px',
                background: '#FFFFFF',
                border: '3px solid #000000',
                borderRadius: '16px',
                marginBottom: '16px'
              }}>
                <QRCodeSVG
                  value={qrPayload}
                  size={240}
                  level="H"
                />
              </div>

              <div style={{ fontSize: '24px', fontWeight: 900, color: '#000000', marginBottom: '4px' }}>
                {shop.name}
              </div>

              <div style={{ fontSize: '13px', color: '#555555', fontWeight: 600, marginBottom: '16px' }}>
                {t('posterMerchantCodeLine', { code: displayShopCode, category: displayCategory })}
              </div>

              <div style={{
                background: '#F8F8F8',
                border: '1px solid #DDDDDD',
                borderRadius: '10px',
                padding: '12px',
                fontSize: '12px',
                color: '#333333',
                lineHeight: 1.5
              }}>
                <div style={{ fontWeight: 800, marginBottom: '4px' }}>{t('posterHowToPayTitle')}</div>
                {t('posterPrintStepGuide')}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
