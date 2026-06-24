import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function Payslips() {
  const [staff, setStaff] = useState<any[]>([]);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedStaff, setSelectedStaff] = useState('');
  const [form, setForm] = useState({ basic_salary: 0, overtime: 0, allowance: 0, uif: 0, paye: 0, other_deduction: 0 });
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getStaff().then(setStaff).catch(() => {});
    loadPayslips();
  }, [month, year]);

  const loadPayslips = () => {
    api.getPayslips(month, year).then(setPayslips).catch(() => {});
  };

  const handleStaffChange = (id: string) => {
    setSelectedStaff(id);
    const s = staff.find(x => x.staff_id === id);
    if (s) {
      setForm({
        basic_salary: s.basic_salary || 0,
        overtime: 0, allowance: 0,
        uif: s.uif_enabled ? Math.round(s.basic_salary * 0.01) : 0,
        paye: s.paye_enabled ? 0 : 0,
        other_deduction: 0
      });
    }
  };

  const grossPay = form.basic_salary + form.overtime + form.allowance;
  const totalDeductions = form.uif + form.paye + form.other_deduction;
  const netPay = grossPay - totalDeductions;

  const generatePDF = async () => {
    if (!pdfRef.current) return;
    const canvas = await html2canvas(pdfRef.current, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 190;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 10;

    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    pdf.save(`Payslip_${selectedStaff}_${month}_${year}.pdf`);
  };

  const handleCreate = async () => {
    if (!selectedStaff) return;
    setLoading(true);
    try {
      await api.createPayslip({
        staff_id: selectedStaff,
        pay_period_month: month,
        pay_period_year: year,
        gross_pay: grossPay,
        total_deductions: totalDeductions,
        net_pay: netPay,
        items: [
          { item_type: 'earning', item_name: 'Basic Salary', amount: form.basic_salary },
          { item_type: 'earning', item_name: 'Overtime', amount: form.overtime },
          { item_type: 'earning', item_name: 'Allowance', amount: form.allowance },
          { item_type: 'deduction', item_name: 'UIF', amount: form.uif },
          { item_type: 'deduction', item_name: 'PAYE', amount: form.paye },
          { item_type: 'deduction', item_name: 'Other', amount: form.other_deduction },
        ]
      });
      loadPayslips();
      setShowPreview(false);
      alert('Payslip generated successfully!');
    } catch (e) {
      alert('Failed to create payslip');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Payslips</h2>
        <p>Generate, preview, download, and email staff payslips for the month.</p>
      </div>

      <div className="card" style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
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
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Staff Member</label>
          <select value={selectedStaff} onChange={e => handleStaffChange(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E5E7EB' }}>
            <option value="">Select staff...</option>
            {staff.map(s => <option key={s.staff_id} value={s.staff_id}>{s.full_name} ({s.job_title})</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={() => setShowPreview(true)} disabled={!selectedStaff}>Preview & Create</button>
      </div>

      {showPreview && selectedStaff && (
        <div className="card" style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3>Payslip Preview</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setShowPreview(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={generatePDF}>📥 Download PDF</button>
              <button className="btn btn-success" onClick={handleCreate} disabled={loading}>{loading ? 'Saving...' : '✓ Save Payslip'}</button>
            </div>
          </div>

          {/* PDF Template */}
          <div ref={pdfRef} style={{ background: 'white', padding: 32, border: '1px solid #E5E7EB', maxWidth: 800, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0B5FB3', paddingBottom: 16, marginBottom: 24 }}>
              <div>
                <img src="https://i.imgur.com/0COuhlX.png" alt="Lehakwe Daycare Logo" style={{ height: 50, width: 'auto', marginBottom: 8 }} />
                <h1 style={{ color: '#0B5FB3', fontSize: '1.5rem', margin: 0 }}>Lehakwe Daycare</h1>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#6B7280' }}>
                  12625 Phase 6, Bloemfontein<br />
                  NPO No: 22910695<br />
                  info@lehakwedaycare.co.za | https://lehakwedaycare.co.za
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>PAYSLIP</h2>
                <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: '#6B7280' }}>
                  Period: {new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}<br />
                  Date: {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
              <div>
                <h4 style={{ margin: '0 0 8px', fontSize: '0.85rem', color: '#6B7280', textTransform: 'uppercase' }}>Employee Details</h4>
                <p style={{ fontSize: '0.95rem', margin: '4px 0' }}><strong>{staff.find(s => s.staff_id === selectedStaff)?.full_name}</strong></p>
                <p style={{ fontSize: '0.85rem', color: '#6B7280', margin: '2px 0' }}>Emp No: {staff.find(s => s.staff_id === selectedStaff)?.employee_number || 'N/A'}</p>
                <p style={{ fontSize: '0.85rem', color: '#6B7280', margin: '2px 0' }}>ID: {staff.find(s => s.staff_id === selectedStaff)?.id_number || 'N/A'}</p>
                <p style={{ fontSize: '0.85rem', color: '#6B7280', margin: '2px 0' }}>Title: {staff.find(s => s.staff_id === selectedStaff)?.job_title}</p>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', marginBottom: 24 }}>
              <thead>
                <tr style={{ background: '#F3F4F6' }}>
                  <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #E5E7EB' }}>Earnings</th>
                  <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #E5E7EB' }}>Amount (ZAR)</th>
                  <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #E5E7EB' }}>Deductions</th>
                  <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #E5E7EB' }}>Amount (ZAR)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '8px', borderBottom: '1px solid #F3F4F6' }}>Basic Salary</td>
                  <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #F3F4F6' }}>{form.basic_salary.toFixed(2)}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #F3F4F6' }}>UIF (Employee)</td>
                  <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #F3F4F6' }}>{form.uif.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px', borderBottom: '1px solid #F3F4F6' }}>Overtime</td>
                  <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #F3F4F6' }}>{form.overtime.toFixed(2)}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #F3F4F6' }}>PAYE</td>
                  <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #F3F4F6' }}>{form.paye.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px', borderBottom: '1px solid #F3F4F6' }}>Allowances</td>
                  <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #F3F4F6' }}>{form.allowance.toFixed(2)}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #F3F4F6' }}>Other Deductions</td>
                  <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #F3F4F6' }}>{form.other_deduction.toFixed(2)}</td>
                </tr>
                <tr style={{ fontWeight: 700, background: '#FEF3C7' }}>
                  <td style={{ padding: '12px 8px' }}>GROSS PAY</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>{grossPay.toFixed(2)}</td>
                  <td style={{ padding: '12px 8px' }}>TOTAL DEDUCTIONS</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>{totalDeductions.toFixed(2)}</td>
                </tr>
                <tr style={{ fontWeight: 700, fontSize: '1.1rem', background: '#D1FAE5' }}>
                  <td colSpan={2} style={{ padding: '12px 8px', textAlign: 'right' }}>NET PAY</td>
                  <td colSpan={2} style={{ padding: '12px 8px', textAlign: 'right', color: '#059669' }}>R {netPay.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ marginTop: 48, display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#6B7280' }}>
              <div>
                <p>Prepared by: Lehakwe Daycare Admin</p>
                <p style={{ marginTop: 24, borderTop: '1px solid #E5E7EB', paddingTop: 8, width: 200 }}>Employee Signature & Date</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p>Generated by Lehakwe Daycare Manager</p>
                <p>Powered by ChiefCare by ChiefOps</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Payslips for {new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
        {payslips.length === 0 ? (
          <p style={{ color: '#6B7280' }}>No payslips generated for this month yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E5E7EB', textAlign: 'left' }}>
                <th style={{ padding: '12px 8px' }}>Employee</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>Gross</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>Deductions</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>Net Pay</th>
                <th style={{ padding: '12px 8px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {payslips.map(p => {
                const emp = staff.find(s => s.staff_id === p.staff_id);
                return (
                  <tr key={p.payslip_id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '12px 8px', fontWeight: 500 }}>{emp?.full_name || 'Unknown'}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>R {p.gross_pay.toFixed(2)}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>R {p.total_deductions.toFixed(2)}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600, color: '#059669' }}>R {p.net_pay.toFixed(2)}</td>
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 100, fontSize: '0.75rem', fontWeight: 600,
                        background: p.status === 'paid' ? '#D1FAE5' : '#FEF3C7',
                        color: p.status === 'paid' ? '#059669' : '#D97706',
                        textTransform: 'capitalize'
                      }}>{p.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
