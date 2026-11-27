import React, { useState } from 'react';
import { Sparkles, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';
import { testGeminiKey } from '../services/api';

export default function GeminiKeyModal({ isOpen, onClose, selectedModel, onSelectModel }) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  if (!isOpen) return null;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testGeminiKey();
      if (res.success) {
        setTestResult({ success: true, message: 'Gemini API key is active on server.' });
      } else {
        setTestResult({ success: false, message: res.message || 'Verification failed.' });
      }
    } catch (err) {
      setTestResult({ success: false, message: err.message || 'Connection test error.' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="card-elevated modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>

        <div style={{ marginBottom: '18px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>AI Settings</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            The Gemini API key is configured on the server via <code>.env</code> (GEMINI_API_KEY). No key entry needed in the UI.
          </p>
        </div>

        <div className="form-stack">
          <div className="field">
            <label className="field-label">Model</label>
            <select
              value={selectedModel}
              onChange={(e) => onSelectModel(e.target.value)}
            >
              <option value="gemini-3.8-flash">Gemini 3.8 Flash</option>
            </select>
          </div>

          {testResult && (
            <div className={`alert ${testResult.success ? 'alert-success' : 'alert-danger'}`}>
              {testResult.success ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />}
              {testing ? 'Testing…' : 'Test server key'}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={onClose}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
