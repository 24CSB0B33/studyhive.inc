import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, ThumbsUp, ThumbsDown, Sparkles, Plus, BookOpen,
  ChevronDown, ChevronUp, FileText, X, Upload, Download,
  Clock, Star, ArrowDownAZ
} from 'lucide-react';
import { fetchResources, voteResource, createResource, uploadFile } from '../services/api';

const FILE_TYPE_LABELS = {
  'application/pdf': 'PDF',
  'image/jpeg': 'Image',
  'image/png': 'Image',
  'image/gif': 'GIF',
  'image/webp': 'Image',
  'text/plain': 'Text',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
  'application/msword': 'DOC',
  'application/vnd.ms-powerpoint': 'PPT'
};

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getNetScore(item) {
  return (item.upvotes?.length || 0) - (item.downvotes?.length || 0);
}

export default function ResourceHub({
  roomId,
  currentUser,
  socket,
  roomJoined = false,
  onGenerateQuizFromNote
}) {
  const [resources, setResources] = useState([]);
  const [search, setSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingResources, setIsLoadingResources] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [resourceError, setResourceError] = useState('');
  const [isSavingResource, setIsSavingResource] = useState(false);
  const [sortBy, setSortBy] = useState('score'); // 'score' | 'newest' | 'name'

  // Text note form
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newTags, setNewTags] = useState('Operating Systems, Notes');

  // File upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null); 
  const [uploadError, setUploadError] = useState('');
  const [uploadedFileData, setUploadedFileData] = useState(null);
  const fileInputRef = useRef(null);

  const loadResources = useCallback(async (isCurrent = () => true) => {
    try {
      const res = await fetchResources(roomId, '', searchTerm);
      if (isCurrent() && res.success && res.resources) {
        setResources(res.resources);
      }
      if (isCurrent()) setIsLoadingResources(false);
    } catch (err) {
      console.warn('Failed to fetch resources:', err);
      if (isCurrent()) setIsLoadingResources(false);
    }
  }, [roomId, searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let isCurrent = true;
    setIsLoadingResources(true);
    setResources([]);
    loadResources(() => isCurrent);
    return () => {
      isCurrent = false;
    };
  }, [loadResources]);

  useEffect(() => {
    if (!socket) return;

    const handleVoted = (updatedRes) => {
      if (updatedRes.roomId !== roomId) return;
      setResources((prev) =>
        prev.map((r) => (r.id === updatedRes.id ? updatedRes : r))
      );
    };

    const handleAdded = (newRes) => {
      if (newRes.roomId !== roomId) return;
      setResources((prev) => [newRes, ...prev.filter((resource) => resource.id !== newRes.id)]);
    };

    socket.on('resource-voted', handleVoted);
    socket.on('resource-upvoted', handleVoted); 
    socket.on('resource-added', handleAdded);

    return () => {
      socket.off('resource-voted', handleVoted);
      socket.off('resource-upvoted', handleVoted);
      socket.off('resource-added', handleAdded);
    };
  }, [socket, roomId]);

  const handleVote = async (resourceId, voteType) => {
    try {
      const res = await voteResource(roomId, resourceId, currentUser.id, voteType);
      if (res.success && res.resource) {
        setResources((prev) =>
          prev.map((r) => (r.id === res.resource.id ? res.resource : r))
        );
      }
    } catch (err) {
      console.error('Vote failed:', err);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setSelectedFile(null);
        setUploadedFileData(null);
        setUploadProgress('error');
        setUploadError('File is too large. Maximum size is 10 MB.');
        e.target.value = '';
        return;
      }
      setSelectedFile(file);
      setUploadedFileData(null);
      setUploadError('');
      setUploadProgress(null);
    }
  };

  const handleCreateNote = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !roomJoined || isSavingResource) return;
    setIsSavingResource(true);
    setResourceError('');

    try {
      let attachment = uploadedFileData;
      if (selectedFile && !attachment) {
        setUploadProgress('uploading');
        setUploadError('');
        attachment = await uploadFile(selectedFile, roomId, currentUser.id);
        if (!attachment.success) throw new Error(attachment.message || 'File upload failed.');
        setUploadedFileData(attachment);
        setUploadProgress('done');
      }
      const resourceData = {
        title: newTitle.trim(),
        description: newDescription.trim(),
        content: newContent.trim(),
        tags: newTags.split(',').map((t) => t.trim()).filter(Boolean),
        uploaderId: currentUser.id,
        uploaderName: currentUser.name
      };

      // Attach file data if uploaded
      if (attachment) {
        resourceData.fileUrl = attachment.fileUrl;
        resourceData.fileName = attachment.fileName;
        resourceData.fileType = attachment.fileType;
        resourceData.fileSize = attachment.fileSize;
      }

      const res = await createResource(roomId, resourceData);

      if (res.success && res.resource) {
        setShowAddModal(false);
        resetForm();
        setResources((prev) => [res.resource, ...prev.filter((resource) => resource.id !== res.resource.id)]);
      } else {
        setResourceError(res.message || 'This resource could not be added to the room.');
      }
    } catch (err) {
      console.error('Failed to create note:', err);
      setUploadProgress(selectedFile ? 'error' : uploadProgress);
      setUploadError(selectedFile ? (err.message || 'File upload failed.') : '');
      setResourceError(err.message || 'Could not publish this resource. Check your connection and try again.');
    } finally {
      setIsSavingResource(false);
    }
  };

  const resetForm = () => {
    setNewTitle('');
    setNewDescription('');
    setNewContent('');
    setNewTags('Operating Systems, Notes');
    setSelectedFile(null);
    setUploadedFileData(null);
    setUploadProgress(null);
    setUploadError('');
  };

  // Sort resources client-side
  const sortedResources = [...resources].sort((a, b) => {
    if (sortBy === 'score') {
      return getNetScore(b) - getNetScore(a);
    } else if (sortBy === 'newest') {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  });

  return (
    <div className="card-sleek panel resource-panel">
      <div className="panel-header">
        <span className="panel-title">
          <BookOpen size={15} /> Room resources
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Sort control */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              title="Sort by score"
              className={`btn-ghost btn-sm${sortBy === 'score' ? ' btn-sort-active' : ''}`}
              onClick={() => setSortBy('score')}
              style={sortBy === 'score' ? { color: 'var(--accent)', background: 'var(--accent-dim)' } : {}}
            >
              <Star size={12} />
            </button>
            <button
              title="Sort by newest"
              className={`btn-ghost btn-sm${sortBy === 'newest' ? ' btn-sort-active' : ''}`}
              onClick={() => setSortBy('newest')}
              style={sortBy === 'newest' ? { color: 'var(--accent)', background: 'var(--accent-dim)' } : {}}
            >
              <Clock size={12} />
            </button>
            <button
              title="Sort by name"
              aria-label="Sort by name"
              className={`btn-ghost btn-sm${sortBy === 'name' ? ' btn-sort-active' : ''}`}
              onClick={() => setSortBy('name')}
              style={sortBy === 'name' ? { color: 'var(--accent)', background: 'var(--accent-dim)' } : {}}
            >
              <ArrowDownAZ size={12} />
            </button>
          </div>

          <button
            onClick={() => {
              setResourceError('');
              setShowAddModal(true);
            }}
            className="btn-primary btn-sm"
          >
            <Plus size={13} /> Add
          </button>
        </div>
      </div>

      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="input-wrap">
          <Search size={14} className="input-icon" />
          <input
            type="text"
            placeholder="Search resources..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="panel-body">
        {isLoadingResources ? (
          <div className="empty" style={{ marginTop: '40px' }}>Loading room resources…</div>
        ) : sortedResources.length === 0 ? (
          <div className="empty" style={{ marginTop: '40px' }}>No resources in this room yet. Add the first one!</div>
        ) : (
          sortedResources.map((item) => {
            const isUpvoted = item.upvotes?.includes(currentUser.id);
            const isDownvoted = item.downvotes?.includes(currentUser.id);
            const netScore = getNetScore(item);
            const isExpanded = expandedId === item.id;
            const fileTypeLabel = item.fileType ? (FILE_TYPE_LABELS[item.fileType] || 'File') : null;

            return (
              <div key={item.id} className="resource-card paper-page notebook-page">
                {/* Title row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  {/* Vote column */}
                  <div className="vote-column">
                    <button
                      onClick={() => handleVote(item.id, 'up')}
                      className={`vote-btn vote-up${isUpvoted ? ' voted' : ''}`}
                      title="Upvote"
                    >
                      <ThumbsUp size={13} fill={isUpvoted ? 'currentColor' : 'none'} />
                    </button>
                    <span className={`vote-score${netScore > 0 ? ' positive' : netScore < 0 ? ' negative' : ''}`}>
                      {netScore}
                    </span>
                    <button
                      onClick={() => handleVote(item.id, 'down')}
                      className={`vote-btn vote-down${isDownvoted ? ' voted' : ''}`}
                      title="Downvote"
                    >
                      <ThumbsDown size={13} fill={isDownvoted ? 'currentColor' : 'none'} />
                    </button>
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="btn-ghost"
                      style={{ padding: 0, justifyContent: 'flex-start', textAlign: 'left', height: 'auto', width: '100%' }}
                    >
                      <FileText size={14} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', flex: 1, textAlign: 'left' }}>{item.title}</span>
                      {fileTypeLabel && (
                        <span className="badge badge-honey" style={{ fontSize: '0.65rem', flexShrink: 0 }}>{fileTypeLabel}</span>
                      )}
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>

                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginTop: '4px' }}>
                      {item.description}
                    </p>

                    {/* Tags */}
                    {item.tags && item.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                        {item.tags.map((tag) => (
                          <span key={tag} className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Expanded content */}
                    {isExpanded && item.content && (
                      <div className="resource-content">
                        {item.content}
                      </div>
                    )}

                    {/* File download */}
                    {item.fileUrl && (
                      <div style={{ marginTop: '8px' }}>
                        <a
                          href={item.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-secondary btn-sm"
                          style={{ display: 'inline-flex', textDecoration: 'none' }}
                        >
                          <Download size={12} />
                          {item.fileName || 'Download file'}
                          {item.fileSize && <span style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem' }}>({formatFileSize(item.fileSize)})</span>}
                        </a>
                      </div>
                    )}

                    {/* Footer meta */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '8px',
                      fontSize: '0.7rem',
                      color: 'var(--text-tertiary)'
                    }}>
                      <span>{item.uploaderName}</span>
                      <button
                        onClick={() => onGenerateQuizFromNote(item)}
                        className="badge badge-violet"
                        style={{ cursor: 'pointer' }}
                      >
                        <Sparkles size={10} />
                        Quiz
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Resource Modal */}
      {showAddModal && (
        <div className="overlay" onClick={() => { setShowAddModal(false); resetForm(); }}>
          <div className="card-elevated modal" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="modal-close"
              onClick={() => { setShowAddModal(false); resetForm(); }}
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '16px' }}>
              Add to this room
            </h4>
            <form onSubmit={handleCreateNote} className="form-stack">
              {resourceError && <div className="alert alert-danger" role="alert">{resourceError}</div>}
              <div className="field">
                <label className="field-label">Title</label>
                <input
                  type="text"
                  placeholder="e.g. Peterson's algorithm"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label className="field-label">Summary</label>
                <input
                  type="text"
                  placeholder="One-line description"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>

              <div className="field">
                <label className="field-label">Content</label>
                <textarea
                  placeholder="Key points..."
                  rows={3}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                />
              </div>

              <div className="field">
                <label className="field-label">Tags</label>
                <input
                  type="text"
                  placeholder="Operating Systems, Concurrency"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                />
              </div>

              {/* File upload section */}
              <div className="field">
                <label className="field-label">Attach file (optional)</label>
                <div className="file-upload-zone" onClick={() => fileInputRef.current?.click()}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.txt,.docx,.pptx"
                    style={{ display: 'none' }}
                    onClick={(e) => e.stopPropagation()}
                    onChange={handleFileSelect}
                  />
                  {selectedFile ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                        <FileText size={14} />
                        {selectedFile.name}
                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>
                          ({formatFileSize(selectedFile.size)})
                        </span>
                      </span>
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                          setUploadedFileData(null);
                          setUploadProgress(null);
                          setUploadError('');
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
                      <Upload size={20} style={{ margin: '0 auto 6px', display: 'block' }} />
                      Click to upload PDF, JPG, PNG, GIF, TXT, DOCX, or PPTX (max 10 MB)
                    </div>
                  )}
                </div>

                {uploadProgress === 'done' && uploadedFileData && (
                  <div className="alert alert-success" style={{ fontSize: '0.75rem' }}>
                    ✓ Attached: {uploadedFileData.fileName}
                  </div>
                )}

                {selectedFile && uploadProgress === 'uploading' && <div className="alert" style={{ fontSize: '0.75rem' }}>Uploading attachment…</div>}

                {uploadProgress === 'error' && (
                  <div className="alert alert-danger" style={{ fontSize: '0.75rem' }}>
                    {uploadError}
                  </div>
                )}
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={!roomJoined || isSavingResource}>
                  {isSavingResource ? (selectedFile && uploadProgress !== 'done' ? 'Uploading…' : 'Publishing…') : roomJoined ? 'Publish' : 'Joining room…'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
