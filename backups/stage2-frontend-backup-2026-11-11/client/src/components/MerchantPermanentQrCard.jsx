import React, { useState, useRef } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
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
  const [copied, setCopied] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const qrCanvasRef = useRef(null);

  if (!shop) return null;

  const qrPayload = shop.qr_string || `VP52:MERCHANT:${shop.permanent_qr_code}`;
  const qrStatus = shop.qr_status || 'active';
  const isActive = shop.status === 'active' && qrStatus === 'active';

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

    // Header branding
    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VP52 • ONE APP, ALL SHOPS', width / 2, 80);

    ctx.fillStyle = '#F2D675';
    ctx.font = '22px sans-serif';
    ctx.fillText('SCAN & PAY COINS HERE', width / 2, 120);

    // 1 Coin = 1 Rupee badge
    ctx.fillStyle = '#1A1A1A';
    ctx.fillRect(100, 145, 600, 46);
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 2;
    ctx.strokeRect(100, 145, 600, 46);

    ctx.fillStyle = '#22C55E';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('★ 1 VP52 COIN = ₹1 INSTANT DISCOUNT ★', width / 2, 175);

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
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText(shop.name, width / 2, 700);

    ctx.fillStyle = '#A0A0A0';
    ctx.font = '20px sans-serif';
    ctx.fillText(`Category: ${shop.category || 'Local Shop'} • ID: ${shop.shop_code || `SHOP-${shop.id}`}`, width / 2, 740);

    if (shop.address) {
      ctx.fillStyle = '#888888';
      ctx.font = '16px sans-serif';
      const addressText = shop.address.length > 55 ? shop.address.substring(0, 52) + '...' : shop.address;
      ctx.fillText(addressText, width / 2, 775);
    }

    // Step-by-step footer guide
    ctx.fillStyle = '#141414';
    ctx.fillRect(60, 810, 680, 120);
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(60, 810, 680, 120);

    ctx.fillStyle = '#F2D675';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText('HOW CUSTOMERS PAY WITH VP52 COINS:', width / 2, 840);

    ctx.fillStyle = '#E0E0E0';
    ctx.font = '15px sans-serif';
    ctx.fillText('1. Open VP52 App   ➜   2. Tap "Scan & Pay Coins"   ➜   3. Enter Coin Amount', width / 2, 880);

    ctx.fillStyle = '#22C55E';
    ctx.font = '14px sans-serif';
    ctx.fillText('Verified VP52 Merchant Counter Partner • Instant Settlement', width / 2, 915);

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
          title: `${shop.name} - VP52 Merchant QR`,
          text: `Pay with VP52 Coins at ${shop.name} and get instant ₹ discounts! Merchant Code: ${shop.permanent_qr_code}`,
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
                  My VP52 Permanent QR
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
                  {isActive ? 'ACTIVE • ACCEPTING COINS' : qrStatus.toUpperCase()}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#A0A0A0', margin: '4px 0 0 0' }}>
                Static merchant counter QR • 1 Coin = ₹1 instant bill discount
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
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
              <Download size={14} /> Download PNG
            </button>

            <button
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
              <Printer size={14} /> Print Poster
            </button>

            <button
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
              <Share2 size={14} /> Share
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
                  onClick={handleCopyCode}
                  title="Copy QR Code"
                  style={{ background: 'none', border: 'none', color: copied ? '#22c55e' : '#888', cursor: 'pointer', padding: '2px', display: 'flex' }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <div style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>
                Permanent Identifier • Never expires
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
                Merchant ID: <span style={{ color: '#FFFFFF', fontWeight: 700 }}>{shop.shop_code || `SHOP-${shop.id}`}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#A0A0A0', marginBottom: '4px' }}>
                Category: <span style={{ color: '#F2D675', fontWeight: 700 }}>{shop.category || 'Retail'}</span>
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
                  How Merchant QR Payments Work
                </span>
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '11px', color: '#B0B0B0', lineHeight: 1.7 }}>
                <li>Display this permanent QR code at your checkout counter or billing desk.</li>
                <li>Customer opens VP52 and taps <strong>"Scan & Pay Coins"</strong> to scan your QR.</li>
                <li>Customer chooses how many coins to spend (1 coin = ₹1 instant bill discount).</li>
                <li>Coins are transferred instantly into your <strong>Merchant Coin Wallet</strong>.</li>
                <li>You receive an immediate in-app payment alert confirming the customer name and discount given.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Printable Counter Standee Poster Modal */}
      {showPrintModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 1200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
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
                <Printer size={18} color="#D4AF37" />
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#FFF', margin: 0 }}>
                  Print Counter Standee Poster
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
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
                  <Printer size={14} /> Print Now
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}
                >
                  <X size={20} />
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
                One App, All Shops & Services
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
                ★ PAY WITH VP52 COINS HERE ★
              </div>

              <div style={{ fontSize: '14px', color: '#16a34a', fontWeight: 800, marginBottom: '20px' }}>
                1 COIN = ₹1 INSTANT BILL DISCOUNT
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
                Merchant Code: {shop.shop_code || `SHOP-${shop.id}`} • {shop.category || 'Retail'}
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
                <div style={{ fontWeight: 800, marginBottom: '4px' }}>HOW TO PAY:</div>
                1. Open VP52 App ➜ 2. Tap <strong>"Scan & Pay"</strong> ➜ 3. Enter Coins
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
