import React, { useState, useEffect } from 'react';
import {
  Package,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ShoppingCart,
  Sparkles,
  DollarSign,
  Info
} from 'lucide-react';
import { api } from './apiClient.js';

export default function RestockChannel3() {
  const [inventory, setInventory] = useState([]);
  const [spendingLimit, setSpendingLimit] = useState(500);
  const [loading, setLoading] = useState(true);
  const [orderingItem, setOrderingItem] = useState(null);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    try {
      setLoading(true);
      const res = await api.getRestockInventory();
      if (res.data) {
        setInventory(res.data.items || []);
        setSpendingLimit(res.data.spending_limit_usd || 500);
      }
    } catch (err) {
      console.warn('Failed to fetch restock inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOrder = async (item) => {
    const qty = item.recommended_order_qty || 5;
    const estCost = item.unit_cost_usd * qty;

    if (estCost > spendingLimit) {
      setErrorMessage(`Guardrail Block: Order total ($${estCost.toFixed(2)}) exceeds autonomous spending limit of $${spendingLimit.toFixed(2)}.`);
      setTimeout(() => setErrorMessage(''), 5000);
      return;
    }

    try {
      setOrderingItem(item.id);
      setErrorMessage('');
      const res = await api.orderRestock(item.id, qty, 'Authorized Warehouse Manager');
      setOrderSuccess({
        itemName: item.name,
        qty,
        total: estCost,
        orderId: res.order?.order_id || 'C3-ORD-9912'
      });
      await loadInventory();
      setTimeout(() => setOrderSuccess(null), 6000);
    } catch (err) {
      setErrorMessage('Order blocked: ' + err.message);
      setTimeout(() => setErrorMessage(''), 5000);
    } finally {
      setOrderingItem(null);
    }
  };

  return (
    <div className="paypal-card" style={{ padding: '28px', borderTop: '4px solid #003087' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '24px',
        paddingBottom: '16px',
        borderBottom: '1px solid var(--border-light)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: '#e0f2fe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Package size={22} color="#0070ba" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#003087' }}>
                Channel3 Merchant Supply Restock
              </h2>
              <p style={{ fontSize: '0.84rem', color: '#475569' }}>
                Autonomous supply replenishment to prevent order fulfillment disputes and shipping delays
              </p>
            </div>
          </div>
        </div>

        {/* Guardrail Policy Tag */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: '#faf5ff',
          border: '1.5px solid #d8b4fe',
          borderRadius: 'var(--radius-md)',
          padding: '10px 18px'
        }}>
          <Lock size={18} color="#9333ea" />
          <div>
            <div style={{ fontSize: '0.7rem', color: '#7e22ce', fontWeight: 800, textTransform: 'uppercase' }}>
              Autonomous Spend Ceiling
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#6b21a8' }}>
              ${spendingLimit.toFixed(2)} USD Cap
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {orderSuccess && (
        <div style={{
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          borderRadius: '8px',
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }} className="animate-fade">
          <CheckCircle2 size={20} color="#059669" />
          <div style={{ fontSize: '0.86rem', color: '#065f46' }}>
            <strong>Dispatched:</strong> Order <strong>{orderSuccess.orderId}</strong> for {orderSuccess.qty}x {orderSuccess.itemName} (${orderSuccess.total.toFixed(2)} USD) successfully submitted.
          </div>
        </div>
      )}

      {errorMessage && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }} className="animate-fade">
          <AlertTriangle size={20} color="#dc2626" />
          <div style={{ fontSize: '0.86rem', color: '#991b1b', fontWeight: 600 }}>
            {errorMessage}
          </div>
        </div>
      )}

      {/* Grid of Restock Items */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '20px'
      }}>
        {inventory.map(item => {
          const isCritical = item.urgency === 'HIGH' || item.current_stock < item.safety_stock;
          const orderTotal = (item.unit_cost_usd * item.recommended_order_qty).toFixed(2);
          const exceedsCap = parseFloat(orderTotal) > spendingLimit;

          return (
            <div
              key={item.id}
              style={{
                background: '#ffffff',
                border: isCritical ? '1.5px solid #fecdca' : '1px solid var(--border-light)',
                borderRadius: 'var(--radius-md)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{
                    fontSize: '0.72rem',
                    background: '#f1f5f9',
                    color: '#475569',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: 700
                  }}>
                    {item.id}
                  </span>

                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-pill)',
                    background: item.urgency === 'HIGH' ? '#fef2f2' : item.urgency === 'MEDIUM' ? '#fffbeb' : '#f0fdf4',
                    color: item.urgency === 'HIGH' ? '#b91c1c' : item.urgency === 'MEDIUM' ? '#b45309' : '#15803d',
                    border: `1px solid ${item.urgency === 'HIGH' ? '#fecaca' : item.urgency === 'MEDIUM' ? '#fde68a' : '#bbf7d0'}`
                  }}>
                    {item.urgency === 'HIGH' ? 'CRITICAL RESTOCK' : item.urgency === 'MEDIUM' ? 'REPLENISH' : 'OPTIMAL'}
                  </span>
                </div>

                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#003087', marginBottom: '8px' }}>
                  {item.name}
                </h3>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: '#f8fafc',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  marginBottom: '12px'
                }}>
                  <div>
                    <span style={{ color: '#687173' }}>In Stock: </span>
                    <strong style={{ color: item.current_stock < item.safety_stock ? '#dc2626' : '#16a34a' }}>
                      {item.current_stock}
                    </strong>
                    <span style={{ color: '#94a3b8' }}> / {item.safety_stock} safe</span>
                  </div>
                  <div>
                    <span style={{ color: '#687173' }}>Unit Cost: </span>
                    <strong style={{ color: '#0f172a' }}>${item.unit_cost_usd.toFixed(2)}</strong>
                  </div>
                </div>

                <div style={{
                  fontSize: '0.78rem',
                  color: '#475569',
                  lineHeight: '1.45',
                  marginBottom: '16px',
                  background: '#faf5ff',
                  border: '1px solid #f3e8ff',
                  padding: '8px 10px',
                  borderRadius: '6px'
                }}>
                  <strong style={{ color: '#7e22ce' }}>AI Recommendation: </strong>
                  {item.ai_recommendation_reason}
                </div>
              </div>

              <div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                  fontSize: '0.82rem'
                }}>
                  <span style={{ color: '#64748b' }}>Order Qty: <strong>{item.recommended_order_qty} units</strong></span>
                  <span style={{ fontWeight: 800, color: '#003087' }}>Est. Total: ${orderTotal}</span>
                </div>

                <button
                  onClick={() => handleOrder(item)}
                  disabled={orderingItem === item.id || item.recommended_order_qty <= 0}
                  className="btn btn-paypal-gold"
                  style={{ width: '100%', padding: '9px 16px', fontSize: '0.86rem' }}
                >
                  <ShoppingCart size={15} />
                  {orderingItem === item.id ? 'Dispatching...' : `Order ${item.recommended_order_qty} Units`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
