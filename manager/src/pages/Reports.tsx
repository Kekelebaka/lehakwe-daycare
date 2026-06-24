import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import jsPDF from 'jspdf';

export default function Reports() {
  const [compliance, setCompliance] = useState<any[]>([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<any>({});

  useEffect(() => {
    api.getCompliance().then(setCompliance).catch(() => {});
    api.getSettings().then(setSettings).catch(() => {});
  }, []);

  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});

  const handleStatusChange = async (id: string, status: string) => {
    setCompliance(prev => prev.map(c => c.compliance_id === id ? { ...c, status } : c));
    try {
      const item = compliance.find(c => c.compliance_id === id);
      await api.updateCompliance(id, status, item?.notes || '');
    } catch {
      api.getCompliance().then(setCompliance).catch(() => {});
    }
  };

  const handleNotesChange = (id: string, notes: string) => {
    setEditingNotes(prev => ({ ...prev, [id]: notes }));
  };

  const handleNotesSave = async (id: string) => {
    const item = compliance.find(c => c.compliance_id === id);
    if (!item) return;
    const notes = editingNotes[id] ?? item.notes ?? '';
    try {
      await api.updateCompliance(id, item.status, notes);
      setCompliance(prev => prev.map(c => c.compliance_id === id ? { ...c, notes } : c));
      setEditingNotes(prev => { const n = { ...prev }; delete n[id]; return n; });
    } catch {
      alert('Failed to save notes.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return { bg: '#D1FAE5', text: '#059669' };
      case 'needs_attention': return { bg: '#FEF3C7', text: '#D97706' };
      case 'expired': return { bg: '#FEE2E2', text: '#DC2626' };
      default: return { bg: '#F3F4F6', text: '#6B7280' };
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'complete': return 'Complete';
      case 'needs_attention': return 'Needs Attention';
      case 'expired': return 'Expired';
      default: return 'Missing';
    }
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const margin = 20;
      let y = 20;

      // Header — blue bar
      pdf.setFillColor(26, 61, 124); // #1A3D7C
      pdf.rect(0, 0, pageWidth, 40, 'F');

      // Daycare name
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text(settings.daycare_name || 'Lehakwe Daycare', margin, 18);

      // NPO + address
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`NPO: ${settings.npo_number || '22910695'}  |  ${settings.daycare_address || '12625 Phase 6, Bloemside'}`, margin, 26);
      pdf.text(`${settings.official_email || 'info@lehakwedaycare.co.za'}  |  ${settings.website || 'https://lehakwedaycare.co.za'}`, margin, 32);

      y = 50;

      // Report title
      pdf.setTextColor(26, 61, 124);
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
      pdf.text(`Monthly Compliance Report`, margin, y);
      y += 8;
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Period: ${monthName} ${year}  |  Generated: ${new Date().toLocaleDateString()}`, margin, y);
      y += 12;

      // Summary stats
      const total = compliance.length;
      const complete = compliance.filter(c => c.status === 'complete').length;
      const needsAttention = compliance.filter(c => c.status === 'needs_attention').length;
      const missing = compliance.filter(c => c.status === 'missing').length;
      const expired = compliance.filter(c => c.status === 'expired').length;

      // Summary boxes
      const boxWidth = 38;
      const boxGap = 6;
      const boxY = y;
      const boxes = [
        { label: 'Total', count: total, color: [55, 65, 81] },
        { label: 'Complete', count: complete, color: [5, 150, 105] },
        { label: 'Attention', count: needsAttention, color: [217, 119, 6] },
        { label: 'Missing', count: missing, color: [220, 38, 38] },
        { label: 'Expired', count: expired, color: [156, 163, 175] },
      ];

      boxes.forEach((box, i) => {
        const bx = margin + i * (boxWidth + boxGap);
        pdf.setFillColor(248, 250, 252);
        pdf.roundedRect(bx, boxY, boxWidth, 22, 3, 3, 'F');
        pdf.setTextColor(box.color[0], box.color[1], box.color[2]);
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text(String(box.count), bx + boxWidth / 2, boxY + 10, { align: 'center' });
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'normal');
        pdf.text(box.label, bx + boxWidth / 2, boxY + 16, { align: 'center' });
      });

      y = boxY + 30;

      // Compliance items by category
      const categories = Array.from(new Set(compliance.map(c => c.category)));

      categories.forEach(cat => {
        // Check if we need a new page
        if (y > 250) {
          pdf.addPage();
          y = 20;
        }

        // Category header
        pdf.setFillColor(243, 244, 246);
        pdf.rect(margin, y - 4, pageWidth - 2 * margin, 8, 'F');
        pdf.setTextColor(55, 65, 81);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text(cat.toUpperCase(), margin + 2, y + 1);
        y += 10;

        // Items
        compliance.filter(c => c.category === cat).forEach(item => {
          if (y > 265) {
            pdf.addPage();
            y = 20;
          }

          // Status dot
          const sc = getStatusColor(item.status);
          const rgb = sc.text === '#059669' ? [5, 150, 105]
            : sc.text === '#D97706' ? [217, 119, 6]
            : sc.text === '#DC2626' ? [220, 38, 38]
            : [107, 114, 128];
          pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
          pdf.circle(margin + 3, y - 1, 1.5, 'F');

          // Item name
          pdf.setTextColor(31, 41, 55);
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          pdf.text(item.item_name, margin + 8, y);

          // Status label
          pdf.setTextColor(rgb[0], rgb[1], rgb[2]);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(8);
          pdf.text(statusLabel(item.status), pageWidth - margin, y, { align: 'right' });

          y += 5;

          // Notes if present
          const notes = editingNotes[item.compliance_id] ?? item.notes ?? '';
          if (notes) {
            pdf.setTextColor(107, 114, 128);
            pdf.setFontSize(7);
            pdf.setFont('helvetica', 'italic');
            const noteLines = pdf.splitTextToSize(`Notes: ${notes}`, pageWidth - 2 * margin - 8);
            pdf.text(noteLines, margin + 8, y);
            y += noteLines.length * 3.5;
          }

          y += 2;
        });

        y += 4;
      });

      // Footer on last page
      const footerY = 280;
      pdf.setDrawColor(229, 231, 235);
      pdf.line(margin, footerY, pageWidth - margin, footerY);
      pdf.setTextColor(156, 163, 175);
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Lehakwe Daycare — Monthly Compliance Report', margin, footerY + 5);
      pdf.text('Powered by ChiefOps AI', pageWidth - margin, footerY + 5, { align: 'right' });

      // Save
      const filename = `Lehakwe_Compliance_${monthName}_${year}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const categories = Array.from(new Set(compliance.map(c => c.category)));

  return (
    <div>
      <div className="page-header">
        <h2>Monthly Reports & Compliance</h2>
        <p>Generate the monthly admin pack and track compliance checklist status.</p>
      </div>

      <div className="card" style={{ display: 'flex', gap: 16, alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Month</label>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #E5E7EB' }}>
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('default', { month: 'long' })}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Year</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #E5E7EB' }}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={generateReport} disabled={loading}>
          {loading ? 'Generating...' : '📑 Generate Monthly Admin Pack (PDF)'}
        </button>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Compliance Checklist</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {categories.map(cat => (
            <div key={cat}>
              <h4 style={{ fontSize: '0.9rem', color: '#6B7280', textTransform: 'uppercase', marginBottom: 8, borderBottom: '1px solid #E5E7EB', paddingBottom: 4 }}>{cat}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {compliance.filter(c => c.category === cat).map(item => {
                  const colors = getStatusColor(item.status);
                  const isEditingNotes = editingNotes[item.compliance_id] !== undefined;
                  const currentNotes = isEditingNotes ? editingNotes[item.compliance_id] : (item.notes || '');
                  return (
                    <div key={item.compliance_id} style={{ padding: '10px 12px', background: '#F9FAFB', borderRadius: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{item.item_name}</div>
                        <select 
                          value={item.status} 
                          onChange={e => handleStatusChange(item.compliance_id, e.target.value)}
                          style={{
                            padding: '4px 8px', borderRadius: 100, border: 'none', fontSize: '0.75rem', fontWeight: 600,
                            background: colors.bg, color: colors.text, cursor: 'pointer', textTransform: 'capitalize'
                          }}
                        >
                          <option value="complete">Complete</option>
                          <option value="needs_attention">Needs Attention</option>
                          <option value="missing">Missing</option>
                          <option value="expired">Expired</option>
                        </select>
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="text"
                          placeholder="Add notes…"
                          value={currentNotes}
                          onChange={e => handleNotesChange(item.compliance_id, e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleNotesSave(item.compliance_id); }}
                          style={{
                            flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid #E5E7EB',
                            fontSize: '0.8rem', fontFamily: 'inherit',
                          }}
                        />
                        {isEditingNotes && (
                          <button onClick={() => handleNotesSave(item.compliance_id)}
                            style={{
                              padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                              background: '#1A3D7C', color: 'white', fontSize: '0.75rem', fontWeight: 600,
                            }}>
                            Save
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
