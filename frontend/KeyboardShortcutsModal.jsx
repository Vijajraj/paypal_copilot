import React, { useEffect, useRef } from 'react';
import {
  Keyboard,
  X,
  Sparkles,
  ShieldCheck,
  Eye,
  Command,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';

export default function KeyboardShortcutsModal({ onClose }) {
  const modalRef = useRef(null);

  useEffect(() => {
    // Focus modal container on open for keyboard traps
    if (modalRef.current) {
      modalRef.current.focus();
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const shortcuts = [
    {
      combo: 'Alt + S',
      altCombo: 'Ctrl + Shift + S',
      action: 'Simulate Dispute Webhook',
      description: 'Trigger incoming customer dispute simulation (INR, SNAD, or Urgent)'
    },
    {
      combo: 'Alt + A',
      altCombo: 'Ctrl + Shift + A',
      action: 'Cryptographic Audit Trail',
      description: 'Open the immutable SHA-256 ledger of human-in-the-loop decisions'
    },
    {
      combo: '?',
      altCombo: 'Shift + /',
      action: 'Help & Shortcuts Guide',
      description: 'Display this interactive keyboard shortcuts and accessibility dialog'
    },
    {
      combo: 'Esc',
      altCombo: 'Escape',
      action: 'Close Modal / Dismiss',
      description: 'Dismiss any open dialog or return focus to the disputes table'
    },
    {
      combo: 'Tab / Shift+Tab',
      altCombo: 'Tab',
      action: 'Navigate Controls',
      description: 'Cycle forward or backward through all interactive buttons and inputs'
    },
    {
      combo: 'Enter / Space',
      altCombo: 'Return',
      action: 'Activate Focused Item',
      description: 'Open selected dispute case, toggle tabs, or confirm actions'
    }
  ];

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={modalRef}
        data-testid="modal-shortcuts"
        className="modal-content animate-fade"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-dialog-title"
        aria-describedby="shortcuts-dialog-desc"
        tabIndex="-1"
        style={{ maxWidth: '640px' }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border-light)',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: '#e0f2fe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Keyboard size={22} color="#0070ba" />
            </div>
            <div>
              <h2 id="shortcuts-dialog-title" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#003087' }}>
                Keyboard Shortcuts & Accessibility Guide
              </h2>
              <p id="shortcuts-dialog-desc" style={{ fontSize: '0.8rem', color: '#475569' }}>
                WCAG 2.1 AA compliant rapid navigation for human agents and automated operators
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close keyboard shortcuts dialog"
            className="btn-paypal-neutral"
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#475569'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Shortcuts List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          {shortcuts.map((sc, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 'var(--radius-md)',
                gap: '16px'
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#0f172a' }}>
                  {sc.action}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                  {sc.description}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="kbd-badge">{sc.combo}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Accessibility Features Highlight */}
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontWeight: 800, fontSize: '0.86rem', marginBottom: '8px' }}>
            <CheckCircle2 size={16} />
            Built-in Accessibility & WCAG 2.1 AA Conformance
          </div>
          <ul style={{ margin: '0 0 0 20px', fontSize: '0.8rem', color: '#15803d', lineHeight: '1.6' }}>
            <li><strong>Skip to Main Content:</strong> Press Tab from top of page to immediately focus dispute workspace.</li>
            <li><strong>Screen Reader Live Regions:</strong> Background syncs and evidence generation announce dynamically without taking focus.</li>
            <li><strong>High-Contrast Focus Outlines:</strong> Blue 2.5px ring for crystal clear focus tracking across all interactive elements.</li>
            <li><strong>Accessible Color Contrast:</strong> Meets &gt; 4.5:1 text-to-background contrast standard across all statuses and badges.</li>
          </ul>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            className="btn btn-paypal-blue"
            style={{ padding: '8px 24px', fontSize: '0.86rem' }}
          >
            Got it, return to Disputes
          </button>
        </div>
      </div>
    </div>
  );
}
