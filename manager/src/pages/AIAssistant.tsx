import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { useRole } from '../App';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'st', label: 'Sesotho' },
  { code: 'af', label: 'Afrikaans' },
  { code: 'zu', label: 'Zulu' },
];

const CATEGORY_ICONS: Record<string, string> = {
  letter: '✉️',
  notice: '📢',
  dsd: '🏛️',
  whatsapp: '💬',
  report: '📊',
};

const DOC_TYPES = [
  { value: 'letter', label: 'Official Letter', icon: '✉️', desc: 'Formal correspondence to parents, staff, or organisations' },
  { value: 'notice', label: 'Notice', icon: '📢', desc: 'Announcements for parents and community' },
  { value: 'memo', label: 'Internal Memo', icon: '📝', desc: 'Internal staff communications' },
  { value: 'certificate', label: 'Certificate', icon: '🏅', desc: 'Achievement or attendance certificates' },
  { value: 'report', label: 'Report', icon: '📊', desc: 'Monthly or quarterly reports' },
  { value: 'invoice', label: 'Invoice / Statement', icon: '💰', desc: 'Fee statements and invoices' },
  { value: 'application', label: 'Application / Request', icon: '📋', desc: 'Applications to DSD, SEDA, or grants' },
  { value: 'custom', label: 'Custom Document', icon: '📄', desc: 'Free-form document with letterhead' },
];

// ── Letterhead Header ─────────────────────────────────────────
function LetterheadHeader({ compact = false }: { compact?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 20,
      borderBottom: '3px solid #0B5FB3', paddingBottom: compact ? 12 : 20,
      marginBottom: compact ? 16 : 28,
    }}>
      <img
        src="https://i.imgur.com/0COuhlX.png"
        alt="Lehakwe Daycare"
        style={{ height: compact ? 50 : 70, width: 'auto', flexShrink: 0 }}
      />
      <div style={{ flex: 1 }}>
        <h1 style={{
          color: '#073B73', fontSize: compact ? '1.2rem' : '1.6rem',
          fontWeight: 800, margin: 0, letterSpacing: '-0.02em',
        }}>
          Lehakwe Daycare
        </h1>
        <p style={{
          color: '#0B5FB3', fontSize: compact ? '0.7rem' : '0.8rem',
          fontWeight: 600, margin: '2px 0 0', letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>
          Early Childhood Development Centre
        </p>
        <div style={{
          marginTop: 6, fontSize: compact ? '0.65rem' : '0.72rem',
          color: '#6B7280', lineHeight: 1.6,
        }}>
          NPO 229-695 &nbsp;|&nbsp; 12625 Phase 6, Bloemside, Bloemfontein 9323
          <br />
          Tel: 061 549 1701 &nbsp;|&nbsp; Email: info@lehakwedaycare.co.za
          &nbsp;|&nbsp; Web: www.lehakwedaycare.co.za
        </div>
      </div>
    </div>
  );
}

// ── Letterhead Footer ─────────────────────────────────────────
function LetterheadFooter() {
  return (
    <div style={{
      borderTop: '2px solid #0B5FB3', paddingTop: 12, marginTop: 40,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      fontSize: '0.6rem', color: '#9CA3AF',
    }}>
      <div>
        <span style={{ fontWeight: 600, color: '#0B5FB3' }}>Lehakwe Daycare</span> &middot;
        NPO 229-695 &middot; Reg. Non-Profit Organisation
      </div>
      <div style={{ textAlign: 'right' }}>
        <div>12625 Phase 6, Bloemside, Bloemfontein 9323</div>
        <div>Tel: 061 549 1701 &middot; info@lehakwedaycare.co.za</div>
      </div>
    </div>
  );
}

// ── Document Creator (Admin Only) ─────────────────────────────
function DocumentCreator() {
  const [docType, setDocType] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [settings, setSettings] = useState<any>({});

  // Form fields
  const [recipientName, setRecipientName] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyContent, setBodyContent] = useState('');
  const [signatoryName, setSignatoryName] = useState('');
  const [signatoryTitle, setSignatoryTitle] = useState('');
  const [reference, setReference] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [useAI, setUseAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getSettings().then(setSettings).catch(() => {});
  }, []);

  const selectedType = DOC_TYPES.find(d => d.value === docType);

  const today = new Date().toLocaleDateString('en-ZA', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const handleAIGenerate = async () => {
    if (!aiPrompt) return;
    setGenerating(true);
    try {
      const res = await api.generateAI({
        custom_prompt: `Write a professional ${docType || 'letter'} for Lehakwe Daycare (NPO 229-695, 12625 Phase 6, Bloemside, Bloemfontein). ${aiPrompt}`,
        language: 'en',
      });
      setBodyContent(res.output);
      setUseAI(false);
    } catch (err: any) {
      alert('AI generation failed: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !previewRef.current) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${subject || 'Lehakwe Daycare Document'}</title>
        <style>
          @page { margin: 20mm 15mm 20mm 15mm; size: A4; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #1a1a1a; line-height: 1.6; padding: 0; }
          .page { max-width: 210mm; margin: 0 auto; padding: 0; }
          h1 { color: #073B73; font-size: 18pt; font-weight: 800; letter-spacing: -0.5px; }
          .subtitle { color: #0B5FB3; font-size: 9pt; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
          .contact-line { font-size: 8pt; color: #6B7280; line-height: 1.5; }
          .header-border { border-bottom: 3px solid #0B5FB3; padding-bottom: 14px; margin-bottom: 22px; }
          .header-row { display: flex; align-items: center; gap: 18px; }
          .header-row img { height: 65px; width: auto; }
          .meta { font-size: 10pt; color: #374151; margin-bottom: 20px; line-height: 1.8; }
          .subject { font-weight: 700; font-size: 11pt; color: #073B73; margin: 16px 0; }
          .body { font-size: 10.5pt; line-height: 1.75; color: #1a1a1a; white-space: pre-wrap; }
          .body p { margin-bottom: 12px; }
          .sign-block { margin-top: 40px; }
          .sign-line { width: 200px; border-bottom: 1px solid #374151; margin-bottom: 6px; padding-bottom: 30px; }
          .sign-name { font-weight: 700; font-size: 10pt; }
          .sign-title { font-size: 9pt; color: #6B7280; }
          .footer { border-top: 2px solid #0B5FB3; padding-top: 10px; margin-top: 40px; display: flex; justify-content: space-between; font-size: 7pt; color: #9CA3AF; }
          .footer .brand { font-weight: 600; color: #0B5FB3; }
        </style>
      </head>
      <body>
        <div class="page">
          ${previewRef.current.innerHTML}
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); };
  };

  const handleDownloadHTML = () => {
    if (!previewRef.current) return;
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${subject || 'Lehakwe Daycare Document'}</title>
<style>
  @page { margin: 20mm 15mm; size: A4; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #1a1a1a; line-height: 1.6; max-width: 210mm; margin: 0 auto; padding: 10mm; }
  h1 { color: #073B73; font-size: 18pt; font-weight: 800; }
  .subtitle { color: #0B5FB3; font-size: 9pt; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
  .contact-line { font-size: 8pt; color: #6B7280; line-height: 1.5; }
  .header-border { border-bottom: 3px solid #0B5FB3; padding-bottom: 14px; margin-bottom: 22px; }
  .header-row { display: flex; align-items: center; gap: 18px; }
  .header-row img { height: 65px; width: auto; }
  .meta { font-size: 10pt; color: #374151; margin-bottom: 20px; line-height: 1.8; }
  .subject { font-weight: 700; font-size: 11pt; color: #073B73; margin: 16px 0; }
  .body { font-size: 10.5pt; line-height: 1.75; color: #1a1a1a; white-space: pre-wrap; }
  .sign-block { margin-top: 40px; }
  .sign-line { width: 200px; border-bottom: 1px solid #374151; margin-bottom: 6px; padding-bottom: 30px; }
  .sign-name { font-weight: 700; font-size: 10pt; }
  .sign-title { font-size: 9pt; color: #6B7280; }
  .footer { border-top: 2px solid #0B5FB3; padding-top: 10px; margin-top: 40px; display: flex; justify-content: space-between; font-size: 7pt; color: #9CA3AF; }
  .footer .brand { font-weight: 600; color: #0B5FB3; }
</style>
</head>
<body>
${previewRef.current.innerHTML}
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(subject || 'lehakwe-document').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── TYPE SELECTOR ───────────────────────────────────────────
  if (!showForm) {
    return (
      <div>
        <div style={{
          background: 'linear-gradient(135deg, #0B5FB3 0%, #073B73 100%)',
          borderRadius: 16, padding: '24px 28px', marginBottom: 20, color: 'white',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: '1.8rem' }}>📜</span>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                Create Official Document
              </h3>
              <p style={{ fontSize: '0.78rem', opacity: 0.85, margin: '2px 0 0' }}>
                Generate professional documents with Lehakwe Daycare letterhead
              </p>
            </div>
          </div>
          <div style={{
            display: 'flex', gap: 16, marginTop: 12, fontSize: '0.7rem', opacity: 0.8,
          }}>
            <span>✓ Official Letterhead</span>
            <span>✓ NPO 229-695</span>
            <span>✓ Print Ready</span>
            <span>✓ AI Assisted</span>
          </div>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 12,
        }}>
          {DOC_TYPES.map(dt => (
            <div
              key={dt.value}
              onClick={() => { setDocType(dt.value); setShowForm(true); }}
              style={{
                background: 'white', borderRadius: 12, padding: '16px 18px',
                border: '1.5px solid #E5E7EB', cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#0B5FB3';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(11,95,179,0.12)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#E5E7EB';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: '1.4rem' }}>{dt.icon}</span>
                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#073B73' }}>
                  {dt.label}
                </span>
              </div>
              <p style={{ fontSize: '0.72rem', color: '#6B7280', lineHeight: 1.4, margin: 0 }}>
                {dt.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── DOCUMENT FORM + PREVIEW ─────────────────────────────────
  return (
    <div>
      {/* Back Button + Type Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button
          onClick={() => { setShowForm(false); setShowPreview(false); setBodyContent(''); setSubject(''); setRecipientName(''); }}
          style={{
            padding: '6px 14px', borderRadius: 8, border: '1px solid #E5E7EB',
            background: 'white', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600,
          }}
        >
          ← Back
        </button>
        <span style={{
          padding: '4px 12px', borderRadius: 20, background: '#EFF6FF',
          color: '#0B5FB3', fontSize: '0.75rem', fontWeight: 600,
        }}>
          {selectedType?.icon} {selectedType?.label}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* LEFT: Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ padding: '18px 20px' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#073B73', marginBottom: 14 }}>
              Document Details
            </h4>

            {/* Reference */}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Reference Number (optional)</label>
              <input
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="e.g. LD/2026/001"
                style={inputStyle}
              />
            </div>

            {/* Recipient */}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Recipient Name</label>
              <input
                value={recipientName}
                onChange={e => setRecipientName(e.target.value)}
                placeholder="e.g. Mr. & Mrs. Mokoena"
                style={inputStyle}
              />
            </div>

            {/* Recipient Address */}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Recipient Address (optional)</label>
              <textarea
                value={recipientAddress}
                onChange={e => setRecipientAddress(e.target.value)}
                placeholder="e.g. 1234 Phase 6, Bloemside"
                rows={2}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            {/* Subject */}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Subject / Title</label>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g. Re: School Fees for Term 3"
                style={inputStyle}
              />
            </div>

            {/* Body */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={labelStyle}>Document Content</label>
                <button
                  onClick={() => setUseAI(!useAI)}
                  style={{
                    padding: '2px 10px', borderRadius: 6, fontSize: '0.68rem',
                    border: useAI ? '1.5px solid #7C3AED' : '1px solid #E5E7EB',
                    background: useAI ? '#F5F3FF' : 'white', cursor: 'pointer',
                    color: useAI ? '#7C3AED' : '#6B7280', fontWeight: 600,
                  }}
                >
                  🤖 {useAI ? 'AI Mode On' : 'Use AI to Write'}
                </button>
              </div>

              {useAI ? (
                <div>
                  <textarea
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    placeholder="Describe what you want to say... e.g. 'Inform parents that fees for Term 3 are due by 31 July. Include banking details and mention that late payment incurs a R50 penalty.'"
                    rows={4}
                    style={{ ...inputStyle, resize: 'vertical', marginBottom: 8 }}
                  />
                  <button
                    onClick={handleAIGenerate}
                    disabled={generating || !aiPrompt}
                    style={{
                      width: '100%', padding: '10px', borderRadius: 8, border: 'none',
                      background: generating ? '#C4B5FD' : '#7C3AED',
                      color: 'white', fontWeight: 700, fontSize: '0.82rem',
                      cursor: generating ? 'wait' : 'pointer',
                    }}
                  >
                    {generating ? '⏳ Generating with AI...' : '🤖 Generate Content'}
                  </button>
                </div>
              ) : (
                <textarea
                  value={bodyContent}
                  onChange={e => setBodyContent(e.target.value)}
                  placeholder="Write your document content here...&#10;&#10;Dear [Recipient],&#10;&#10;We are writing to inform you that..."
                  rows={10}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 180 }}
                />
              )}
            </div>

            {/* Signatory */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Signatory Name</label>
                <input
                  value={signatoryName}
                  onChange={e => setSignatoryName(e.target.value)}
                  placeholder={settings.manager_name || 'Nolaphamo Rakabee'}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Signatory Title</label>
                <input
                  value={signatoryTitle}
                  onChange={e => setSignatoryTitle(e.target.value)}
                  placeholder="Centre Manager"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setShowPreview(true)}
              disabled={!bodyContent}
              style={{
                flex: 1, padding: '12px', borderRadius: 10, border: 'none',
                background: !bodyContent ? '#D1D5DB' : '#0B5FB3',
                color: 'white', fontWeight: 700, fontSize: '0.85rem',
                cursor: !bodyContent ? 'not-allowed' : 'pointer',
              }}
            >
              👁️ Preview Document
            </button>
          </div>
        </div>

        {/* RIGHT: Preview */}
        <div>
          {showPreview && bodyContent ? (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button
                  onClick={handlePrint}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #0B5FB3',
                    background: '#0B5FB3', color: 'white', fontWeight: 600,
                    fontSize: '0.78rem', cursor: 'pointer',
                  }}
                >
                  🖨️ Print Document
                </button>
                <button
                  onClick={handleDownloadHTML}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #E5E7EB',
                    background: 'white', fontWeight: 600,
                    fontSize: '0.78rem', cursor: 'pointer',
                  }}
                >
                  💾 Download HTML
                </button>
              </div>

              {/* Preview Card */}
              <div
                ref={previewRef}
                style={{
                  background: 'white', borderRadius: 12, padding: '32px 36px',
                  border: '1px solid #E5E7EB', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                  fontSize: '0.82rem', color: '#1a1a1a', lineHeight: 1.7,
                }}
              >
                {/* LETTERHEAD */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 18,
                  borderBottom: '3px solid #0B5FB3', paddingBottom: 16, marginBottom: 22,
                }}>
                  <img
                    src="https://i.imgur.com/0COuhlX.png"
                    alt="Lehakwe Daycare"
                    style={{ height: 65, width: 'auto', flexShrink: 0 }}
                  />
                  <div>
                    <h1 style={{
                      color: '#073B73', fontSize: '1.45rem', fontWeight: 800,
                      margin: 0, letterSpacing: '-0.02em',
                    }}>
                      Lehakwe Daycare
                    </h1>
                    <p style={{
                      color: '#0B5FB3', fontSize: '0.7rem', fontWeight: 600,
                      margin: '2px 0 0', letterSpacing: '0.08em', textTransform: 'uppercase',
                    }}>
                      Early Childhood Development Centre
                    </p>
                    <div style={{
                      marginTop: 5, fontSize: '0.66rem', color: '#6B7280', lineHeight: 1.5,
                    }}>
                      NPO 229-695 &nbsp;|&nbsp; 12625 Phase 6, Bloemside, Bloemfontein 9323
                      <br />
                      Tel: 061 549 1701 &nbsp;|&nbsp; info@lehakwedaycare.co.za
                      &nbsp;|&nbsp; www.lehakwedaycare.co.za
                    </div>
                  </div>
                </div>

                {/* META */}
                <div style={{ marginBottom: 18, fontSize: '0.78rem', color: '#374151', lineHeight: 1.9 }}>
                  {reference && <div><strong>Ref:</strong> {reference}</div>}
                  <div><strong>Date:</strong> {today}</div>
                  {recipientName && (
                    <div>
                      <strong>To:</strong> {recipientName}
                      {recipientAddress && <><br /><span style={{ paddingLeft: 32, color: '#6B7280' }}>{recipientAddress}</span></>}
                    </div>
                  )}
                </div>

                {/* SUBJECT */}
                {subject && (
                  <div style={{
                    fontWeight: 700, fontSize: '0.95rem', color: '#073B73',
                    margin: '14px 0', paddingBottom: 6,
                    borderBottom: '1px solid #E5E7EB',
                  }}>
                    {subject}
                  </div>
                )}

                {/* BODY */}
                <div style={{
                  whiteSpace: 'pre-wrap', fontSize: '0.82rem',
                  lineHeight: 1.75, color: '#1a1a1a',
                }}>
                  {bodyContent}
                </div>

                {/* SIGNATORY */}
                <div style={{ marginTop: 36 }}>
                  <div style={{
                    width: 180, borderBottom: '1px solid #374151',
                    paddingBottom: 28, marginBottom: 6,
                  }} />
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#073B73' }}>
                    {signatoryName || settings.manager_name || 'Nolaphamo Rakabee'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#6B7280' }}>
                    {signatoryTitle || 'Centre Manager'}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#9CA3AF', marginTop: 2 }}>
                    Lehakwe Daycare &middot; NPO 229-695
                  </div>
                </div>

                {/* FOOTER */}
                <div style={{
                  borderTop: '2px solid #0B5FB3', paddingTop: 10, marginTop: 36,
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: '0.58rem', color: '#9CA3AF',
                }}>
                  <div>
                    <span style={{ fontWeight: 600, color: '#0B5FB3' }}>Lehakwe Daycare</span> &middot;
                    NPO 229-695 &middot; Reg. Non-Profit Organisation
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div>12625 Phase 6, Bloemside, Bloemfontein 9323</div>
                    <div>Tel: 061 549 1701 &middot; info@lehakwedaycare.co.za</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              background: '#F9FAFB', borderRadius: 12, padding: 40,
              border: '2px dashed #E5E7EB', textAlign: 'center', color: '#9CA3AF',
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📄</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>
                Document Preview
              </div>
              <div style={{ fontSize: '0.72rem' }}>
                Fill in the details and click "Preview Document"<br />
                to see your letterhead document here
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.72rem', fontWeight: 600,
  color: '#374151', marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8,
  border: '1px solid #E5E7EB', fontSize: '0.82rem',
  outline: 'none', fontFamily: 'inherit',
};

// ── Main AI Assistant Component ───────────────────────────────
export default function AIAssistant() {
  const { role } = useRole();
  const isAdmin = role === 'admin';

  const [templates, setTemplates] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [customPrompt, setCustomPrompt] = useState('');
  const [language, setLanguage] = useState('en');
  const [generating, setGenerating] = useState(false);
  const [output, setOutput] = useState('');
  const [activeTab, setActiveTab] = useState<'generate' | 'history' | 'custom' | 'document'>('generate');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([api.getAITemplates(), api.getAIDocs()])
      .then(([t, d]) => { setTemplates(t); setDocs(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSelectTemplate = (tpl: any) => {
    setSelectedTemplate(tpl);
    setOutput('');
    const vars: Record<string, string> = {};
    if (tpl.variables) {
      try {
        JSON.parse(tpl.variables as string).forEach((v: string) => { vars[v] = ''; });
      } catch {}
    }
    setVariables(vars);
    setActiveTab('generate');
  };

  const handleGenerate = async () => {
    if (!selectedTemplate && !customPrompt) return;
    setGenerating(true);
    setOutput('');
    try {
      const res = await api.generateAI({
        template_id: selectedTemplate?.template_id,
        variables: selectedTemplate ? variables : undefined,
        custom_prompt: !selectedTemplate ? customPrompt : undefined,
        language,
      });
      setOutput(res.output);
      const newDocs = await api.getAIDocs();
      setDocs(newDocs);
    } catch (err: any) {
      setOutput(`Error: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLetter = () => {
    const letter = `LEHAKWE DAYCARE
NPO 229-695
12625 Phase 6, Bloemside, 9323
Tel: 061 549 1701
Email: info@lehakwedaycare.co.za

${output}`;
    navigator.clipboard.writeText(letter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: '#6B7280' }}>Loading AI Assistant...</div>;

  const tabs = [
    { key: 'generate', label: '📝 Templates' },
    { key: 'custom', label: '✍️ Custom' },
    { key: 'history', label: '📋 History' },
    ...(isAdmin ? [{ key: 'document', label: '📜 Create Document' }] : []),
  ];

  return (
    <div>
      <div className="page-header">
        <h2>🤖 AI Assistant</h2>
        <p>Generate letters, notices, and correspondence with AI</p>
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: '#F3F4F6', borderRadius: 10, padding: 4 }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: '0.78rem', fontWeight: 600,
              background: activeTab === tab.key ? 'white' : 'transparent',
              color: activeTab === tab.key ? '#0B5FB3' : '#6B7280',
              boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Language Selector (not for document tab) */}
      {activeTab !== 'document' && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, marginRight: 8 }}>Language:</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {LANGUAGES.map(l => (
              <button key={l.code} onClick={() => setLanguage(l.code)}
                style={{
                  padding: '4px 12px', borderRadius: 6,
                  border: language === l.code ? '2px solid #0B5FB3' : '1px solid #E5E7EB',
                  background: language === l.code ? '#EFF6FF' : 'white',
                  fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                  color: language === l.code ? '#0B5FB3' : '#6B7280',
                }}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* DOCUMENT CREATOR TAB (Admin Only) */}
      {activeTab === 'document' && isAdmin && <DocumentCreator />}

      {/* TEMPLATES TAB */}
      {activeTab === 'generate' && (
        <>
          {!selectedTemplate ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {templates.map(tpl => (
                <div key={tpl.template_id} onClick={() => handleSelectTemplate(tpl)}
                  className="card" style={{
                    cursor: 'pointer',
                    borderLeft: `4px solid ${
                      tpl.category === 'letter' ? '#2563EB' : tpl.category === 'dsd' ? '#7C3AED' : tpl.category === 'whatsapp' ? '#25D366' : tpl.category === 'report' ? '#059669' : '#F59E0B'
                    }`,
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: '1.2rem' }}>{CATEGORY_ICONS[tpl.category] || '📄'}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{tpl.name}</div>
                      <div style={{ fontSize: '0.65rem', color: '#9CA3AF', textTransform: 'capitalize' }}>{tpl.category}</div>
                    </div>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#6B7280', lineHeight: 1.4 }}>
                    {(tpl.prompt_template as string).slice(0, 100)}...
                  </p>
                  {tpl.variables && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                      {JSON.parse(tpl.variables as string).map((v: string) => (
                        <span key={v} style={{ padding: '2px 6px', borderRadius: 4, background: '#F3F4F6', fontSize: '0.65rem', color: '#6B7280' }}>
                          {v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="card" style={{ borderLeft: '4px solid #0B5FB3' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{selectedTemplate.name}</h3>
                  <p style={{ fontSize: '0.75rem', color: '#6B7280', textTransform: 'capitalize' }}>{selectedTemplate.category} • {language.toUpperCase()}</p>
                </div>
                <button onClick={() => { setSelectedTemplate(null); setOutput(''); }}
                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E5E7EB', background: 'white', fontSize: '0.75rem', cursor: 'pointer' }}>
                  ← Back
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                {Object.keys(variables).map(key => (
                  <div key={key}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4, textTransform: 'capitalize' }}>
                      {key.replace(/_/g, ' ')}
                    </label>
                    <input type="text" value={variables[key]} onChange={e => setVariables({ ...variables, [key]: e.target.value })}
                      placeholder={`Enter ${key.replace(/_/g, ' ')}`}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: '0.9rem' }} />
                  </div>
                ))}
              </div>

              <button onClick={handleGenerate} disabled={generating}
                style={{
                  width: '100%', padding: '12px', borderRadius: 8, border: 'none',
                  background: generating ? '#93C5FD' : '#0B5FB3',
                  color: 'white', fontWeight: 700, fontSize: '0.9rem',
                  cursor: generating ? 'wait' : 'pointer',
                }}>
                {generating ? '⏳ Generating...' : '🤖 Generate with AI'}
              </button>
            </div>
          )}
        </>
      )}

      {/* CUSTOM TAB */}
      {activeTab === 'custom' && (
        <div className="card" style={{ borderLeft: '4px solid #7C3AED' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 12 }}>✍️ Custom AI Prompt</h3>
          <textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)}
            placeholder="Describe what you want to generate... e.g. 'Write a letter to parents about the upcoming Spring Day event on 1 September. Include that children should wear yellow and bring a picnic lunch.'"
            rows={6}
            style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: '0.9rem', resize: 'vertical', marginBottom: 12 }} />
          <button onClick={handleGenerate} disabled={generating || !customPrompt}
            style={{
              width: '100%', padding: '12px', borderRadius: 8, border: 'none',
              background: generating ? '#93C5FD' : '#0B5FB3',
              color: 'white', fontWeight: 700, fontSize: '0.9rem',
              cursor: generating || !customPrompt ? 'wait' : 'pointer',
            }}>
            {generating ? '⏳ Generating...' : '🤖 Generate with AI'}
          </button>
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {docs.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 32, color: '#6B7280' }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>📋</div>
              <div>No documents generated yet.</div>
            </div>
          )}
          {docs.map(doc => (
            <div key={doc.doc_id} className="card" style={{ cursor: 'pointer' }} onClick={() => { setOutput(doc.output_text); setActiveTab('generate'); }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{CATEGORY_ICONS[doc.doc_type] || '📄'}</span>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'capitalize' }}>{doc.doc_type}</span>
                </div>
                <span style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>
                  {new Date(doc.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#6B7280', lineHeight: 1.4 }}>
                {(doc.output_text as string).slice(0, 150)}...
              </p>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <span style={{ padding: '2px 6px', borderRadius: 4, background: '#F3F4F6', fontSize: '0.65rem' }}>
                  {doc.language?.toUpperCase() || 'EN'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* OUTPUT */}
      {output && activeTab !== 'document' && (
        <div className="card" style={{ marginTop: 16, borderLeft: '4px solid #059669' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Generated Output</h3>
            <div style={{ display: 'flex', gap: 6 }}>
              {selectedTemplate?.category === 'letter' && (
                <button onClick={handleCopyLetter}
                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#EFF6FF', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}>
                  {copied ? '✅ Copied!' : '📋 Copy as Letter'}
                </button>
              )}
              <button onClick={handleCopy}
                style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E5E7EB', background: 'white', fontSize: '0.75rem', cursor: 'pointer' }}>
                {copied ? '✅ Copied!' : '📋 Copy'}
              </button>
            </div>
          </div>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', lineHeight: 1.7, color: '#374151', background: '#F9FAFB', padding: 16, borderRadius: 8 }}>
            {output}
          </div>
        </div>
      )}
    </div>
  );
}
