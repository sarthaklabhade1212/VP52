import React from 'react';
import { Link } from 'react-router-dom';
import { Gift, Store, Shield, ArrowRight, Sparkles } from 'lucide-react';

export default function LoginSelector() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div style={{
        maxWidth: '960px',
        width: '100%',
        textAlign: 'center'
      }}>
        {/* Header Branding */}
        <div style={{ marginBottom: '36px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 800,
            fontSize: '32px',
            boxShadow: '0 10px 30px rgba(79, 70, 229, 0.5)',
            marginBottom: '16px'
          }}>
            R
          </div>
          <h1 style={{ fontSize: '32px', color: '#ffffff', marginBottom: '8px' }}>
            Rewardify Portal Selection
          </h1>
          <p style={{ fontSize: '15px', color: '#94a3b8', maxWidth: '500px', margin: '0 auto' }}>
            Select your account portal below to log in to the Customer Rewards & Physical Shop Discount Platform.
          </p>
        </div>

        {/* 3 Portal Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
          textAlign: 'left'
        }}>
          {/* 1. Customer Login Card */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '24px',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            transition: 'transform 0.2s ease'
          }}>
            <div>
              <div style={{
                width: '48px', height: '48px', borderRadius: '14px', background: '#e0e7ff', color: '#4f46e5',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px'
              }}>
                <Gift size={26} />
              </div>
              <span className="badge badge-active" style={{ marginBottom: '8px' }}>Customer Role</span>
              <h3 style={{ fontSize: '20px', color: '#0f172a', marginBottom: '6px' }}>Customer App</h3>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px', lineHeight: 1.5 }}>
                Watch simulated advertisements, earn reward points, browse physical store offers, and generate redemption QR codes.
              </p>
            </div>

            <Link to="/customer/login" className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '14px', textDecoration: 'none' }}>
              Customer Sign In <ArrowRight size={16} />
            </Link>
          </div>

          {/* 2. Shop / Merchant Login Card */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '24px',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            border: '2px solid #10b981'
          }}>
            <div>
              <div style={{
                width: '48px', height: '48px', borderRadius: '14px', background: '#dcfce7', color: '#059669',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px'
              }}>
                <Store size={26} />
              </div>
              <span className="badge badge-active" style={{ background: '#dcfce7', color: '#15803d', marginBottom: '8px' }}>NEW: Shop / Merchant</span>
              <h3 style={{ fontSize: '20px', color: '#0f172a', marginBottom: '6px' }}>Shop / Merchant Portal</h3>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px', lineHeight: 1.5 }}>
                For physical shop owners. Scan customer QR codes, verify discount eligibility with Wrong Shop protection, and approve redemptions.
              </p>
            </div>

            <Link to="/shop/login" className="btn-success" style={{ width: '100%', padding: '14px', fontSize: '14px', textDecoration: 'none', justifyContent: 'center' }}>
              Shop Merchant Sign In <ArrowRight size={16} />
            </Link>
          </div>

          {/* 3. Admin Login Card */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '24px',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
          }}>
            <div>
              <div style={{
                width: '48px', height: '48px', borderRadius: '14px', background: '#f3e8ff', color: '#7c3aed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px'
              }}>
                <Shield size={26} />
              </div>
              <span className="badge" style={{ background: '#f3e8ff', color: '#6b21a8', marginBottom: '8px' }}>Administrator</span>
              <h3 style={{ fontSize: '20px', color: '#0f172a', marginBottom: '6px' }}>Admin Dashboard</h3>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px', lineHeight: 1.5 }}>
                Super administrator panel to manage customers, partner shops, discount offers, platform reward rules, and analytics.
              </p>
            </div>

            <Link to="/admin/login" className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '14px', textDecoration: 'none', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
              Admin Sign In <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
