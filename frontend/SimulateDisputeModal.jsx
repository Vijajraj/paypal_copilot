import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Play,
  AlertTriangle,
  Package,
  ShieldCheck,
  Clock
} from 'lucide-react';
import { api } from './apiClient.js';

export default function SimulateDisputeModal({ onClose, onSimulated }) {
  const [loading, setLoading] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('high_value');
  const [customReason, setCustomReason] = useState('ITEM_NOT_RECEIVED');
  const [customAmount, setCustomAmount] = useState('499.00');
  const [customItem, setCustomItem] = useState('MacBook Pro M3 USB-C Docking Station');
  const [customBuyer, setCustomBuyer] = useState('Alexander Wright');
  const [customCarrier, setCustomCarrier] = useState('UPS');
  const [customDueHours, setCustomDueHours] = useState(48);

  const presets = [
    {
      id: 'high_value',
      title: 'High-Value Item Not Received ($849.50)',
      reason: 'ITEM_NOT_RECEIVED',
      amount: '849.50',
      item: 'Sony Alpha a7 IV Full-Frame Camera',
      buyer: 'Marcus Vance',
      carrier: 'UPS',
      dueHours: 48,
      desc: 'Tests high-value adult signature requirement, KERNEL carrier proof, and Elastic precedent matching.'
    },
    {
      id: 'urgent',
      title: 'URGENT Deadline (< 18 Hours Left)',
      reason: 'UNAUTHORIZED',
      amount: '189.00',
      item: 'AirPods Max Silver (Active Noise Cancellation)',
      buyer: 'Samantha Fox',
      carrier: 'FedEx',
      dueHours: 16,
      desc: 'Triggers deadline radar critical alert and prioritizes response required queue.'
    },
    {
      id: 'snad',
      title: 'Significantly Not As Described (SNAD)',
      reason: 'NOT_AS_DESCRIBED',
      amount: '310.00',
      item: 'Vintage Mechanical Watch (Serviced)',
      buyer: 'David Kim',
      carrier: 'USPS Priority',
      dueHours: 96,
      desc: 'Tests return RMA policy drafting and empirical precedent win-score adjustment.'
    }
  ];

  const handleSimulate = async () => {
    try {
      setLoading(true);
      let payload = {};

      if (selectedPreset === 'custom') {
        payload = {
          reason: customReason,
          amount: customAmount,
          item_name: customItem,
          buyer_name: customBuyer,
          carrier: customCarrier,
          due_hours: Number(customDueHours) || 48
        };
      } else {
        const p = presets.find(x => x.id === selectedPreset);
        payload = {
          reason: p.reason,
          amount: p.amount,
          item_name: p.item,
          buyer_name: p.buyer,
          carrier: p.carrier,
          due_hours: p.dueHours
        };
      }

      const res = await api.simulateDispute(payload);
      if (res.dispute) {
        onSimulated(res.dispute);
        onClose();
      }
    } catch (err) {
      alert('Simulation error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div data-testid="modal-simulate" className="modal-content animate-fade" style={{ maxWidth: '640px' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border-light)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: '#fef9c3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Sparkles size={22} color="#ca8a04" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#003087' }}>
                Simulate PayPal Dispute Webhook
              </h2>
              <p style={{ fontSize: '0.82rem', color: '#475569' }}>
                Triggers an incoming customer dispute event to demonstrate autonomous agent defense drafting
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Preset Cards Selection */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#003087', marginBottom: '10px' }}>
            Choose a Demo Scenario Preset:
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {presets.map(p => (
              <div
                key={p.id}
                onClick={() => setSelectedPreset(p.id)}
                style={{
                  background: selectedPreset === p.id ? '#eff6ff' : '#ffffff',
                  border: `1.5px solid ${selectedPreset === p.id ? '#0070ba' : 'var(--border-light)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 16px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, color: '#003087', fontSize: '0.9rem' }}>
                    {p.title}
                  </span>
                  <span style={{
                    fontSize: '0.74rem',
                    background: '#f1f5f9',
                    color: '#475569',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-pill)',
                    fontWeight: 600
                  }}>
                    {p.carrier} • {p.dueHours}h
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: '1.4' }}>
                  {p.desc}
                </p>
              </div>
            ))}

            {/* Custom Scenario Option */}
            <div
              onClick={() => setSelectedPreset('custom')}
              style={{
                background: selectedPreset === 'custom' ? '#eff6ff' : '#ffffff',
                border: `1.5px solid ${selectedPreset === 'custom' ? '#0070ba' : 'var(--border-light)'}`,
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontWeight: 700, color: '#003087', fontSize: '0.9rem' }}>
                Custom Parameters Scenario
              </div>
              <p style={{ fontSize: '0.78rem', color: '#64748b' }}>
                Specify custom buyer name, disputed amount, carrier, and item description.
              </p>
            </div>
          </div>
        </div>

        {/* Custom Input Fields (Visible when Custom Preset is active) */}
        {selectedPreset === 'custom' && (
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '20px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px'
          }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                Dispute Reason:
              </label>
              <select
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              >
                <option value="ITEM_NOT_RECEIVED">Item Not Received (INR)</option>
                <option value="UNAUTHORIZED">Unauthorized Transaction</option>
                <option value="NOT_AS_DESCRIBED">Significantly Not As Described</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                Disputed Amount (USD):
              </label>
              <input
                type="number"
                step="0.01"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                Buyer Name:
              </label>
              <input
                type="text"
                value={customBuyer}
                onChange={(e) => setCustomBuyer(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                Carrier:
              </label>
              <select
                value={customCarrier}
                onChange={(e) => setCustomCarrier(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              >
                <option value="UPS">UPS</option>
                <option value="FEDEX">FedEx</option>
                <option value="USPS">USPS</option>
                <option value="DHL">DHL</option>
              </select>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                Item Name / Description:
              </label>
              <input
                type="text"
                value={customItem}
                onChange={(e) => setCustomItem(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              />
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            onClick={onClose}
            className="btn btn-paypal-neutral"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            data-testid="btn-trigger-simulation"
            onClick={handleSimulate}
            disabled={loading}
            className="btn btn-paypal-gold"
          >
            <Play size={15} />
            {loading ? 'Simulating Event & Running AI...' : 'Trigger Simulation'}
          </button>
        </div>
      </div>
    </div>
  );
}
