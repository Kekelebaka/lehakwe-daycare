import { useState, useEffect } from 'react';
import { api } from '../lib/api';

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

export default function AIAssistant() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [customPrompt, setCustomPrompt] = useState('');
  const [language, setLanguage] = useState('en');
  const [generating, setGenerating] = useState(false);
  const [output, setOutput] = useState('');
  const [activeTab, setActiveTab] = useState<'generate' | 'history' | 'custom'>('generate');
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
      // Refresh docs list
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
    // Format as a proper letter with header
    const letter = `LEHAKWE DAYCARE
NPO 22910695
12625 Phase 6, Bloemside, 9323
Tel: 061 549 1701
Email: info@lehakwedaycare.co.za

${output}`;
    navigator.clipboard.writeText(letter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: '#6B7280' }}>Loading AI Assistant...</div>;

  return (
    <div>
      <div className="page-header">
        <h2>🤖 AI Assistant</h2>
        <p>Generate letters, notices, and correspondence with AI</p>
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: '#F3F4F6', borderRadius: 10, padding: 4 }}>
        {[
          { key: 'generate', label: '📝 Templates', icon: '' },
          { key: 'custom', label: '✍️ Custom', icon: '' },
          { key: 'history', label: '📋 History', icon: '' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
              background: activeTab === tab.key ? 'white' : 'transparent',
              color: activeTab === tab.key ? '#0B5FB3' : '#6B7280',
              boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Language Selector */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: '0.8rem', fontWeight: 600, marginRight: 8 }}>Language:</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {LANGUAGES.map(l => (
            <button key={l.code} onClick={() => setLanguage(l.code)}
              style={{ padding: '4px 12px', borderRadius: 6, border: language === l.code ? '2px solid #0B5FB3' : '1px solid #E5E7EB',
                background: language === l.code ? '#EFF6FF' : 'white', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                color: language === l.code ? '#0B5FB3' : '#6B7280' }}>
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* TEMPLATES TAB */}
      {activeTab === 'generate' && (
        <>
          {!selectedTemplate ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {templates.map(tpl => (
                <div key={tpl.template_id} onClick={() => handleSelectTemplate(tpl)}
                  className="card" style={{ cursor: 'pointer', borderLeft: `4px solid ${
                    tpl.category === 'letter' ? '#2563EB' : tpl.category === 'dsd' ? '#7C3AED' : tpl.category === 'whatsapp' ? '#25D366' : tpl.category === 'report' ? '#059669' : '#F59E0B'
                  }` }}>
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

              {/* Variable Inputs */}
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
                style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: generating ? '#93C5FD' : '#0B5FB3',
                  color: 'white', fontWeight: 700, fontSize: '0.9rem', cursor: generating ? 'wait' : 'pointer' }}>
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
            style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: generating ? '#93C5FD' : '#0B5FB3',
              color: 'white', fontWeight: 700, fontSize: '0.9rem', cursor: generating || !customPrompt ? 'wait' : 'pointer' }}>
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
      {output && (
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
