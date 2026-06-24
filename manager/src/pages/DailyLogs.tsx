import { useState, useEffect } from 'react';
import { api } from '../lib/api';

const ACTIVITY_TYPES = [
  { key: 'feeding', icon: '🍽️', label: 'Feeding' },
  { key: 'sleep', icon: '😴', label: 'Sleep' },
  { key: 'diaper', icon: '🧷', label: 'Diaper' },
  { key: 'milestone', icon: '🎯', label: 'Milestone' },
  { key: 'general', icon: '📝', label: 'General' },
] as const;

const MOODS = [
  { key: 'happy', emoji: '😊', label: 'Happy' },
  { key: 'sad', emoji: '😢', label: 'Sad' },
  { key: 'tired', emoji: '😴', label: 'Tired' },
  { key: 'sick', emoji: '🤒', label: 'Sick' },
  { key: 'normal', emoji: '😐', label: 'Normal' },
] as const;

export default function DailyLogs() {
  const [children, setChildren] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [childId, setChildId] = useState('');
  const [activityType, setActivityType] = useState('feeding');
  const [description, setDescription] = useState('');
  const [mood, setMood] = useState('happy');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getChildren()
      .then(c => {
        const active = c.filter((ch: any) => ch.status === 'active');
        setChildren(active);
        if (active.length > 0 && !childId) setChildId(active[0].child_id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    api.getDailyLogs(date)
      .then(setLogs)
      .catch(() => setLogs([]));
  }, [date]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!childId || !description.trim()) return;
    setSaving(true);
    try {
      await api.createDailyLog({
        child_id: childId,
        date,
        activity_type: activityType,
        description: description.trim(),
        mood,
        notes: notes.trim() || undefined,
      });
      setDescription('');
      setNotes('');
      const updated = await api.getDailyLogs(date);
      setLogs(updated);
    } catch (err) {
      alert('Failed to save log');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this log entry?')) return;
    try {
      await api.deleteDailyLog(id);
      setLogs(prev => prev.filter(l => l.id !== id));
    } catch {}
  };

  // Group logs by child
  const grouped: Record<string, any[]> = {};
  for (const log of logs) {
    const key = log.child_id || log.child_name || 'unknown';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(log);
  }

  const getChildName = (childId: string) => {
    const child = children.find(c => c.child_id === childId);
    return child?.full_name || childId;
  };

  const getActivityInfo = (type: string) => ACTIVITY_TYPES.find(a => a.key === type) || { icon: '📝', label: type };
  const getMoodInfo = (m: string) => MOODS.find(mo => mo.key === m) || { emoji: '😐', label: m };

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: '#6B7280' }}>Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <h2>Daily Observation Logs</h2>
        <p>Record daily activities and observations for children</p>
      </div>

      {/* Log Entry Form */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 12 }}>New Observation</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Date & Child Row */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: '0.85rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Child</label>
              <select value={childId} onChange={e => setChildId(e.target.value)}
                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: '0.85rem', minWidth: 180 }}>
                {children.map(c => (
                  <option key={c.child_id} value={c.child_id}>{c.full_name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Activity Type */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Activity Type</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ACTIVITY_TYPES.map(a => (
                <button key={a.key} type="button" onClick={() => setActivityType(a.key)}
                  style={{
                    padding: '6px 14px', borderRadius: 8, border: activityType === a.key ? '2px solid #0B5FB3' : '1px solid #E5E7EB',
                    background: activityType === a.key ? '#EBF5FF' : 'white', color: activityType === a.key ? '#0B5FB3' : '#6B7280',
                    fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                  {a.icon} {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mood */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Mood</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {MOODS.map(m => (
                <button key={m.key} type="button" onClick={() => setMood(m.key)}
                  style={{
                    padding: '6px 14px', borderRadius: 8, border: mood === m.key ? '2px solid #0B5FB3' : '1px solid #E5E7EB',
                    background: mood === m.key ? '#EBF5FF' : 'white', color: mood === m.key ? '#0B5FB3' : '#6B7280',
                    fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                  {m.emoji} {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Description *</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Describe the observation..."
              rows={3}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: '0.85rem', resize: 'vertical', fontFamily: 'inherit' }}
              required />
          </div>

          {/* Optional Notes */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: '0.85rem', resize: 'vertical', fontFamily: 'inherit' }} />
          </div>

          {/* Submit */}
          <div>
            <button type="submit" disabled={saving || !description.trim()}
              style={{
                padding: '8px 24px', borderRadius: 8, border: 'none', background: (!saving && description.trim()) ? '#0B5FB3' : '#D1D5DB',
                color: 'white', fontSize: '0.85rem', fontWeight: 600, cursor: (!saving && description.trim()) ? 'pointer' : 'not-allowed',
              }}>
              {saving ? 'Saving...' : '📝 Log Observation'}
            </button>
          </div>
        </form>
      </div>

      {/* Today's Logs */}
      <div className="card">
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 12 }}>
          Observations — {new Date(date + 'T12:00:00').toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </h3>
        {logs.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#6B7280', padding: 20 }}>No observations recorded for this date</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Object.entries(grouped).map(([childKey, childLogs]) => (
              <div key={childKey}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0B5FB3', marginBottom: 8, paddingBottom: 4, borderBottom: '2px solid #EBF5FF' }}>
                  {getChildName(childKey)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {childLogs.map(log => {
                    const activity = getActivityInfo(log.activity_type);
                    const moodInfo = getMoodInfo(log.mood);
                    return (
                      <div key={log.id} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                        background: '#F9FAFB', borderRadius: 10, border: '1px solid #E5E7EB',
                      }}>
                        <div style={{ fontSize: '1.2rem', lineHeight: 1 }}>{activity.icon}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0B5FB3' }}>{activity.label}</span>
                            <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                              {log.time || log.created_at ? new Date(log.time || log.created_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false }) : ''}
                            </span>
                            <span style={{ fontSize: '0.85rem' }}>{moodInfo.emoji}</span>
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#111827', marginBottom: 2 }}>{log.description}</div>
                          {log.notes && <div style={{ fontSize: '0.75rem', color: '#6B7280', fontStyle: 'italic' }}>{log.notes}</div>}
                        </div>
                        <button onClick={() => handleDelete(log.id)}
                          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E5E7EB', background: 'white', color: '#DC2626', fontSize: '0.7rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          🗑️
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
