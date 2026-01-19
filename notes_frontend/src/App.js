import React, { useEffect, useMemo, useState } from 'react';
import './App.css';

const API_BASE_URL = 'http://localhost:3001';

/**
 * @typedef {Object} Note
 * @property {number} id
 * @property {string} title
 * @property {string} content
 * @property {string} created_at
 * @property {string} updated_at
 */

async function apiRequest(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (res.status === 204) return null;

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const detail = (data && (data.detail || data.message)) ? (data.detail || data.message) : `HTTP ${res.status}`;
    throw new Error(detail);
  }

  return data;
}

function formatTimestamp(ts) {
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    return d.toLocaleString();
  } catch {
    return ts;
  }
}

// PUBLIC_INTERFACE
function App() {
  const [notes, setNotes] = useState(/** @type {Note[]} */ ([]));
  const [selectedId, setSelectedId] = useState(/** @type {number|null} */ (null));

  const [editorTitle, setEditorTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [mode, setMode] = useState(/** @type {'create'|'edit'} */ ('create'));

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const selectedNote = useMemo(
    () => (selectedId == null ? null : notes.find(n => n.id === selectedId) || null),
    [notes, selectedId]
  );

  const showToast = (msg) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 1800);
  };

  const resetToCreate = () => {
    setSelectedId(null);
    setMode('create');
    setEditorTitle('');
    setEditorContent('');
    setError('');
  };

  const loadNotes = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest('/notes');
      setNotes(data || []);
      // If currently selected note was deleted elsewhere, reset selection.
      if (selectedId != null && !(data || []).some(n => n.id === selectedId)) {
        resetToCreate();
      }
    } catch (e) {
      setError(`Failed to load notes: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedNote) {
      setMode('edit');
      setEditorTitle(selectedNote.title);
      setEditorContent(selectedNote.content);
    }
  }, [selectedNote]);

  const onSelectNote = (noteId) => {
    setSelectedId(noteId);
    setError('');
  };

  const onCreateNew = () => {
    resetToCreate();
  };

  const onSave = async () => {
    setSaving(true);
    setError('');

    const title = editorTitle.trim();
    const content = editorContent.trim();

    if (!title || !content) {
      setSaving(false);
      setError('Title and content are required.');
      return;
    }

    try {
      if (mode === 'create') {
        const created = await apiRequest('/notes', {
          method: 'POST',
          body: JSON.stringify({ title, content }),
        });
        showToast('Note created');
        await loadNotes();
        setSelectedId(created?.id ?? null);
      } else if (mode === 'edit' && selectedId != null) {
        await apiRequest(`/notes/${selectedId}`, {
          method: 'PUT',
          body: JSON.stringify({ title, content }),
        });
        showToast('Note saved');
        await loadNotes();
      }
    } catch (e) {
      setError(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (selectedId == null) return;
    // basic confirmation to avoid accidental deletions
    // eslint-disable-next-line no-alert
    const ok = window.confirm('Delete this note? This cannot be undone.');
    if (!ok) return;

    setSaving(true);
    setError('');
    try {
      await apiRequest(`/notes/${selectedId}`, { method: 'DELETE' });
      showToast('Note deleted');
      await loadNotes();
      resetToCreate();
    } catch (e) {
      setError(`Delete failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="NotesApp">
      <header className="TopBar">
        <div className="TopBar-left">
          <div className="BrandMark" aria-hidden="true" />
          <div>
            <div className="BrandTitle">Notes</div>
            <div className="BrandSubtitle">Simple full-stack notes app</div>
          </div>
        </div>

        <div className="TopBar-right">
          <button className="Btn BtnSecondary" onClick={loadNotes} disabled={loading || saving}>
            Refresh
          </button>
          <button className="Btn BtnPrimary" onClick={onCreateNew} disabled={saving}>
            New note
          </button>
        </div>
      </header>

      <main className="MainLayout">
        <aside className="Sidebar" aria-label="Notes list">
          <div className="SidebarHeader">
            <div className="SidebarTitle">All notes</div>
            <div className="SidebarMeta">{loading ? 'Loading…' : `${notes.length} notes`}</div>
          </div>

          <div className="NotesList">
            {notes.map((n) => {
              const active = selectedId === n.id;
              return (
                <button
                  key={n.id}
                  className={`NoteCard ${active ? 'active' : ''}`}
                  onClick={() => onSelectNote(n.id)}
                >
                  <div className="NoteCardTitle">{n.title}</div>
                  <div className="NoteCardPreview">
                    {n.content.length > 80 ? `${n.content.slice(0, 80)}…` : n.content}
                  </div>
                  <div className="NoteCardTime">Updated: {formatTimestamp(n.updated_at)}</div>
                </button>
              );
            })}

            {!loading && notes.length === 0 && (
              <div className="EmptyState">
                <div className="EmptyTitle">No notes yet</div>
                <div className="EmptyText">Create your first note using “New note”.</div>
              </div>
            )}
          </div>
        </aside>

        <section className="Editor" aria-label="Note editor">
          <div className="EditorHeader">
            <div>
              <div className="EditorTitle">{mode === 'create' ? 'Create note' : 'Edit note'}</div>
              {mode === 'edit' && selectedNote && (
                <div className="EditorMeta">
                  Created: {formatTimestamp(selectedNote.created_at)} • Updated:{' '}
                  {formatTimestamp(selectedNote.updated_at)}
                </div>
              )}
            </div>

            <div className="EditorActions">
              {mode === 'edit' && (
                <button className="Btn BtnDanger" onClick={onDelete} disabled={saving}>
                  Delete
                </button>
              )}
              <button className="Btn BtnPrimary" onClick={onSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>

          {error && <div className="Alert" role="alert">{error}</div>}
          {toast && <div className="Toast" role="status">{toast}</div>}

          <div className="EditorForm">
            <label className="Field">
              <div className="FieldLabel">Title</div>
              <input
                className="Input"
                value={editorTitle}
                onChange={(e) => setEditorTitle(e.target.value)}
                placeholder="e.g. Grocery list"
                maxLength={200}
              />
            </label>

            <label className="Field">
              <div className="FieldLabel">Content</div>
              <textarea
                className="Textarea"
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                placeholder="Write your note…"
                rows={12}
              />
            </label>
          </div>

          <div className="Hint">
            Backend API: <code>{API_BASE_URL}</code> • OpenAPI docs at <code>{API_BASE_URL}/docs</code>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
