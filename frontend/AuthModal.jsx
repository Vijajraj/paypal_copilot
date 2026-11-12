import React, { useState } from 'react';
import {
  Lock,
  User,
  Shield,
  Eye,
  CheckCircle,
  X,
  AlertCircle,
  Sparkles,
  ArrowRight,
  KeyRound,
  Mail,
  UserCheck
} from 'lucide-react';
import { api } from './apiClient.js';

export default function AuthModal({
  isOpen,
  onClose,
  currentUser,
  onUserChange,
  showToast
}) {
  const [mode, setMode] = useState('demo'); // 'demo' | 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('analyst');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const demoAccounts = api.getFallbackDemoUsers();

  const handleQuickLogin = async (acc) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.login(acc.email, acc.password);
      if (res.user) {
        onUserChange(res.user);
        if (showToast) {
          showToast(`Logged in as ${res.user.full_name} (${res.user.role.toUpperCase()})`);
        }
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to authenticate');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await api.login(email, password);
        if (res.user) {
          onUserChange(res.user);
          if (showToast) showToast(`Welcome back, ${res.user.full_name}!`);
          onClose();
        }
      } else if (mode === 'register') {
        const res = await api.register(email, password, fullName, role);
        if (res.user) {
          onUserChange(res.user);
          if (showToast) showToast(`Account created for ${res.user.full_name}!`);
          onClose();
        }
      }
    } catch (err) {
      setError(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (r) => {
    switch (r) {
      case 'admin':
        return { label: 'Admin', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' };
      case 'analyst':
        return { label: 'Dispute Analyst', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' };
      case 'viewer':
      default:
        return { label: 'Viewer (Read-Only)', color: '#475569', bg: '#f8fafc', border: '#e2e8f0' };
    }
  };

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px'
      }}
    >
      <div
        data-testid="modal-auth"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-auth-title"
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '540px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div style={{
          background: '#001c64',
          padding: '20px 24px',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.15)',
              padding: '8px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Lock size={20} color="#ffffff" />
            </div>
            <div>
              <h2 id="modal-auth-title" style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
                Authentication & Role Access
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.8)', margin: '2px 0 0 0' }}>
                Role-Based Access Control (RBAC) with JWT Bearer Token
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Current Active Account Strip */}
        {currentUser && (
          <div style={{
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            padding: '10px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.82rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Active Profile:</span>
              <strong style={{ color: '#0f172a' }}>{currentUser.full_name}</strong>
              <span style={{ color: '#64748b' }}>({currentUser.email})</span>
            </div>
            <span style={{
              background: getRoleBadge(currentUser.role).bg,
              color: getRoleBadge(currentUser.role).color,
              border: `1px solid ${getRoleBadge(currentUser.role).border}`,
              padding: '2px 8px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '0.74rem'
            }}>
              {getRoleBadge(currentUser.role).label}
            </span>
          </div>
        )}

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e2e8f0',
          padding: '0 24px',
          background: '#ffffff'
        }}>
          <button
            type="button"
            onClick={() => { setMode('demo'); setError(''); }}
            style={{
              padding: '12px 16px',
              border: 'none',
              borderBottom: mode === 'demo' ? '2.5px solid #0070ba' : '2.5px solid transparent',
              color: mode === 'demo' ? '#0070ba' : '#64748b',
              fontWeight: mode === 'demo' ? 700 : 600,
              fontSize: '0.86rem',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Sparkles size={15} />
            1-Click Demo Profiles
          </button>
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); }}
            style={{
              padding: '12px 16px',
              border: 'none',
              borderBottom: mode === 'login' ? '2.5px solid #0070ba' : '2.5px solid transparent',
              color: mode === 'login' ? '#0070ba' : '#64748b',
              fontWeight: mode === 'login' ? 700 : 600,
              fontSize: '0.86rem',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <KeyRound size={15} />
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setError(''); }}
            style={{
              padding: '12px 16px',
              border: 'none',
              borderBottom: mode === 'register' ? '2.5px solid #0070ba' : '2.5px solid transparent',
              color: mode === 'register' ? '#0070ba' : '#64748b',
              fontWeight: mode === 'register' ? 700 : 600,
              fontSize: '0.86rem',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <UserCheck size={15} />
            Register
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', maxHeight: '460px' }}>
          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '0.82rem',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* 1-Click Demo Profiles Tab */}
          {mode === 'demo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '0.84rem', color: '#475569', margin: '0 0 4px 0' }}>
                Select a pre-configured role to immediately test permission gates, approval guardrails, and audit logging:
              </p>

              {demoAccounts.map((acc) => {
                const badge = getRoleBadge(acc.role);
                const isActive = currentUser && currentUser.email === acc.email;

                return (
                  <div
                    key={acc.id}
                    data-testid={`demo-user-${acc.role}`}
                    style={{
                      border: isActive ? `2px solid ${badge.color}` : '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      background: isActive ? badge.bg : '#ffffff',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '50%',
                          background: badge.bg,
                          border: `1px solid ${badge.border}`,
                          color: badge.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.85rem'
                        }}>
                          {acc.name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{acc.name}</strong>
                            <span style={{
                              background: badge.bg,
                              color: badge.color,
                              border: `1px solid ${badge.border}`,
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              padding: '1px 7px',
                              borderRadius: '10px'
                            }}>
                              {acc.label}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{acc.email}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleQuickLogin(acc)}
                        disabled={loading || isActive}
                        style={{
                          background: isActive ? '#e2e8f0' : '#0070ba',
                          color: isActive ? '#64748b' : '#ffffff',
                          border: 'none',
                          padding: '7px 14px',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: isActive ? 'default' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        {isActive ? (
                          <>
                            <CheckCircle size={14} color="#16a34a" />
                            Active
                          </>
                        ) : (
                          <>
                            Sign In
                            <ArrowRight size={13} />
                          </>
                        )}
                      </button>
                    </div>

                    <div style={{
                      fontSize: '0.75rem',
                      color: '#64748b',
                      background: 'rgba(0, 0, 0, 0.02)',
                      padding: '6px 10px',
                      borderRadius: '6px'
                    }}>
                      <strong>Permissions:</strong> {acc.permissions}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Standard Login / Register Form */}
          {(mode === 'login' || mode === 'register') && (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {mode === 'register' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Jordan Miller"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '0.88rem'
                    }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@business.com"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '0.88rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '0.88rem'
                  }}
                />
              </div>

              {mode === 'register' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Assigned Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '0.88rem',
                      background: '#ffffff'
                    }}
                  >
                    <option value="analyst">Dispute Specialist (Review & Submit Evidence)</option>
                    <option value="admin">Lead Admin (Full System & Simulation Access)</option>
                    <option value="viewer">Audit Observer (Read-Only Access)</option>
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  background: '#0070ba',
                  color: '#ffffff',
                  border: 'none',
                  padding: '11px',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  marginTop: '8px',
                  transition: 'background 0.15s'
                }}
              >
                {loading ? 'Authenticating...' : mode === 'login' ? 'Sign In to Resolution Center' : 'Create Account'}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div style={{
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.78rem',
          color: '#64748b'
        }}>
          <span>JWT Expiration: 24 Hours • PBKDF2 Hashing</span>
          {currentUser && (
            <button
              type="button"
              onClick={() => {
                api.logout();
                onUserChange(null);
                if (showToast) showToast('Logged out successfully.');
                onClose();
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#dc2626',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Sign Out Current User
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
