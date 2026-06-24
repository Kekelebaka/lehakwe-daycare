import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export default function Fees() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [children, setChildren] = useState<any[]>([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'records' | 'schedules' | 'generate'>('records');
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [showPayModal, setShowPayModal] = useState<any>(null);

  useEffect(() => {
    Promise.all([api.getFeeSchedules(), api.getFeeRecords(month, year), api.getChildren()])
      .then(([s, r, c]) => { setSchedules(s); setRecords(r); setChildren(c.filter((ch: any) => ch.status === 'active')); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [month, year]);

  const totalDue = records.reduce((sum: number, r: any) => sum + (r.amount_due || 0), 0);
  const totalPaid = records.reduce((sum: number, r: any) => sum + (r.amount_paid || 0), 0);
  const totalOutstanding = totalDue - totalPaid;
  const paidCount = records.filter(r => r.status === 'paid').length;
  const pendingCount = records.filter(r => r.status === 'pending' || r.status === 'partial').length;
  const overdueCount = records.filter(r => r.status === 'overdue').length;

  const generateMonthRecords = async () => {
    for (const child of children) {
      const existing = records.find(r => r.child_id === child.child_id);
      if (!existing) {
        const schedule = schedules.find(s => s.age_group === child.age_group);
        const amount = schedule?.monthly_fee || 500;
        try {
          await api.createFeeRecord({ child_id: child.child_id, schedule_id: schedule?.schedule_id, month, year, amount_due: amount, status: 'pending' });
        } catch {}
      }
    }
    const updated = await api.getFeeRecords(month, year);
    setRecords(updated);
  };

  const recordPayment = async (feeId: string, amount: number, method: string) => {
    const record = records.find(r => r.fee_id === feeId);
    if (!record) return;
    const newPaid = (record.amount_paid || 0) + amount;
    const newStatus = newPaid >= record.amount_due ? 'paid' : 'partial';
    await api.updateFeeRecord(feeId, { amount_paid: newPaid, payment_method: method, payment_date: new Date().toISOString().slice(0, 10), status: newStatus });
    setRecords(prev => prev.map(r => r.fee_id === feeId ? { ...r, amount_paid: newPaid, status: newStatus } : r));
    setShowPayModal(null);
  };

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: '#6B7280' }}>Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <h2>Fees & Finance</h2>
        <p>Track payments, generate statements, manage outstanding balances</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: '#F3F4F6', borderRadius: 8, padding: 4 }}>
        {([['records', '💳 Records'], ['schedules', '📋 Schedules'], ['generate', '⚡ Generate']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key as any)}
            style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
              background: tab === key ? 'white' : 'transparent', color: tab === key ? '#0B5FB3' : '#6B7280',
              boxShadow: tab === key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Period Selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: '0.85rem' }}>
          {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('default', { month: 'long' })}</option>)}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: '0.85rem' }}>
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        <div style={{ background: '#D1FAE5', borderRadius: 12, padding: 12, textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#059669' }}>R{totalPaid.toLocaleString()}</div>
          <div style={{ fontSize: '0.7rem', color: '#059669' }}>Paid ({paidCount})</div>
        </div>
        <div style={{ background: '#FEF3C7', borderRadius: 12, padding: 12, textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#D97706' }}>R{totalOutstanding.toLocaleString()}</div>
          <div style={{ fontSize: '0.7rem', color: '#D97706' }}>Outstanding ({pendingCount})</div>
        </div>
        <div style={{ background: '#FEE2E2', borderRadius: 12, padding: 12, textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#DC2626' }}>{overdueCount}</div>
          <div style={{ fontSize: '0.7rem', color: '#DC2626' }}>Overdue</div>
        </div>
      </div>

      {/* Records Tab */}
      {tab === 'records' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Fee Records</h3>
            <button onClick={() => setShowAddRecord(true)}
              style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#0B5FB3', color: 'white', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
              + Add Record
            </button>
          </div>
          {records.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: '#6B7280' }}>
              No fee records for this period. Use "Generate" to create records for all active children.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {records.map(r => {
                const statusColors: Record<string, { bg: string; text: string }> = {
                  paid: { bg: '#D1FAE5', text: '#059669' },
                  partial: { bg: '#FEF3C7', text: '#D97706' },
                  pending: { bg: '#F3F4F6', text: '#6B7280' },
                  overdue: { bg: '#FEE2E2', text: '#DC2626' },
                };
                const sc = statusColors[r.status] || statusColors.pending;
                return (
                  <div key={r.fee_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#F9FAFB', borderRadius: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{r.child_name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>Due: R{r.amount_due?.toLocaleString()} {r.amount_paid > 0 ? `• Paid: R${r.amount_paid.toLocaleString()}` : ''}</div>
                    </div>
                    <span style={{ padding: '2px 10px', borderRadius: 100, fontSize: '0.7rem', fontWeight: 600, background: sc.bg, color: sc.text, textTransform: 'capitalize' }}>
                      {r.status}
                    </span>
                    {r.status !== 'paid' && (
                      <button onClick={() => setShowPayModal(r)}
                        style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: '#059669', color: 'white', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>
                        Pay
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Schedules Tab */}
      {tab === 'schedules' && (
        <div className="card">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 12 }}>Fee Schedules (per age group)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {schedules.map(s => (
              <div key={s.schedule_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#F9FAFB', borderRadius: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{s.age_group}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>{s.description}</div>
                </div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0B5FB3' }}>R{s.monthly_fee?.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generate Tab */}
      {tab === 'generate' && (
        <div className="card">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 8 }}>Generate Monthly Fee Records</h3>
          <p style={{ fontSize: '0.8rem', color: '#6B7280', marginBottom: 16 }}>
            Create fee records for all active children who don't have a record for {new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}.
          </p>
          <div style={{ background: '#F3F4F6', borderRadius: 8, padding: 12, marginBottom: 16 }}>
            <div style={{ fontSize: '0.8rem', color: '#374151' }}>Active children: <strong>{children.length}</strong></div>
            <div style={{ fontSize: '0.8rem', color: '#374151' }}>Already have records: <strong>{records.length}</strong></div>
            <div style={{ fontSize: '0.8rem', color: '#374151' }}>Will generate: <strong>{children.length - records.filter(r => children.some(c => c.child_id === r.child_id)).length}</strong></div>
          </div>
          <button onClick={generateMonthRecords}
            style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#0B5FB3', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
            ⚡ Generate Records
          </button>
        </div>
      )}

      {/* Payment Modal */}
      {showPayModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
          onClick={() => setShowPayModal(null)}>
          <div style={{ background: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Record Payment</h3>
            <p style={{ fontSize: '0.8rem', color: '#6B7280', marginBottom: 16 }}>{showPayModal.child_name} — R{showPayModal.amount_due?.toLocaleString()} due</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Full Amount', amount: showPayModal.amount_due - (showPayModal.amount_paid || 0), method: 'cash' },
                { label: 'EFT Payment', amount: showPayModal.amount_due - (showPayModal.amount_paid || 0), method: 'eft' },
                { label: 'NSNP Subsidy', amount: showPayModal.amount_due - (showPayModal.amount_paid || 0), method: 'nsnp_subsidy' },
              ].map(opt => (
                <button key={opt.label} onClick={() => recordPayment(showPayModal.fee_id, opt.amount, opt.method)}
                  style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem', fontWeight: 500 }}>
                  {opt.label} — R{opt.amount.toLocaleString()}
                </button>
              ))}
            </div>
            <button onClick={() => setShowPayModal(null)}
              style={{ width: '100%', marginTop: 12, padding: '8px', borderRadius: 8, border: 'none', background: '#F3F4F6', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
