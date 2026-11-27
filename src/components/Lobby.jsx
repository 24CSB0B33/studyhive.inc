import React, { useState } from 'react';
import {
  Users,
  Plus,
  ArrowRight,
  Search,
  Link,
  Copy,
  Check,
  DoorOpen
} from 'lucide-react';
import { createRoom, fetchRoom } from '../services/api';
import { topicGroups } from '../data/topics';

export default function Lobby({
  rooms = [],
  onJoinRoom,
  onRefreshRooms,
  currentUser
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinInput, setJoinInput] = useState('');
  const [joinError, setJoinError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [createdRoomLink, setCreatedRoomLink] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newTopic, setNewTopic] = useState('Computer Science');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState('Computer Science');
  const [visibility,setVisibility]=useState('public');

  const categories = ['All', 'Computer Science', 'Algorithms', 'Architecture', 'General'];

  const filteredRooms = rooms.filter((room) => {
    const matchesCategory = selectedCategory === 'All' || (room.category || '').toLowerCase().includes(selectedCategory.toLowerCase());
    const matchesSearch = !searchQuery ||
      room.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const buildShareLink = (room) => {
    return window.location.origin + '/?join=' + room.id + (room.visibility==='private' && room.inviteToken ? '&invite='+encodeURIComponent(room.inviteToken) : '');
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const res = await createRoom({
        title: newTitle.trim(),
        topic: newTopic.trim(),
        description: newDescription.trim(),
        category: newCategory,
        visibility
      });

      if (res.success && res.room) {
        const shareLink = buildShareLink(res.room);
        setCreatedRoomLink({ link: shareLink, roomId: res.room.id, invite: res.room.inviteToken || '', title: res.room.title });
        setShowCreateModal(false);
        setNewTitle('');
        setNewDescription('');
        await onRefreshRooms();
      }
    } catch (err) {
      console.error('Failed to create room:', err);
    }
  };

  const handleCopyLink = () => {
    if (createdRoomLink) {
      navigator.clipboard.writeText(createdRoomLink.link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleJoinCreated = () => {
    if (createdRoomLink) {
      onJoinRoom(createdRoomLink.roomId, createdRoomLink.invite || '');
      setCreatedRoomLink(null);
    }
  };

  const handleJoinByLink = async (e) => {
    e.preventDefault();
    const pastedValue = joinInput.trim();
    if (!pastedValue) {
      setJoinError('Paste a room link to continue.');
      return;
    }

    let roomId = pastedValue;
    let inviteToken = '';
    try {
      const parsedUrl = new URL(pastedValue, window.location.origin);
        roomId = parsedUrl.searchParams.get('join') || pastedValue;
        inviteToken = parsedUrl.searchParams.get('invite') || '';
    } catch (err) {
      // A plain room code is also accepted.
    }

    roomId = roomId.trim().replace(/^\/+|\/+$/g, '');
    setIsJoining(true);
    setJoinError('');

    try {
      const result = await fetchRoom(roomId, inviteToken);
      if (!result.success || !result.room) {
        setJoinError('That room link could not be found. Check it and try again.');
        return;
      }

      onJoinRoom(result.room.id, inviteToken);
      setShowJoinModal(false);
      setJoinInput('');
    } catch (err) {
      setJoinError('Could not reach the study room. Try again in a moment.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="page lobby-page">
      <div className="hero lobby-hero">
        <div className="lobby-hero-copy">
          <span className="lobby-kicker"><span className="lobby-live-dot" /> THE STUDY CLUB · OPEN ALL HOURS</span>
          <h1>Make room<br />for <em>deep work.</em></h1>
          <p>
            Find your people, pick one thing, and give it your full attention.
          </p>
          <div className="hero-actions">
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary"
            >
              <Plus size={16} /> Start a study room
            </button>
            <button
              onClick={() => {
                setJoinError('');
                setShowJoinModal(true);
              }}
              className="btn-secondary lobby-join-btn"
            >
              <DoorOpen size={16} /> Join with a link
            </button>
          </div>
        </div>

        <div className="lobby-hero-art" role="img" aria-label="A focus rhythm: 25 minutes of focus followed by a five minute reset">
          <div className="focus-orbit" aria-hidden="true">
            <div className="focus-orbit-track" />
            <div className="focus-orbit-dot" />
            <div className="focus-orbit-core">
              <span className="focus-orbit-overline">A LITTLE RHYTHM</span>
              <strong>25<span>/</span>05</strong>
              <span className="focus-orbit-caption">FOCUS · RESET</span>
            </div>
          </div>
          <div className="floating-note">
            <span className="floating-note-label">ROOMS OPEN</span>
            <strong>{String(rooms.length).padStart(2, '0')}</strong>
            <span className="floating-note-copy">and counting</span>
          </div>
          <span className="hero-art-caption">GOOD WORK, IN GOOD COMPANY.</span>
        </div>
      </div>

      {/* Shareable link banner after room creation */}
      {createdRoomLink && (
        <div className="share-banner">
          <div className="share-banner-inner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
              <Link size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '2px' }}>
                  Room created: {createdRoomLink.title}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {createdRoomLink.link}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button onClick={handleCopyLink} className="btn-secondary btn-sm">
                {copiedLink ? <Check size={13} /> : <Copy size={13} />}
                {copiedLink ? 'Copied!' : 'Copy link'}
              </button>
              <button onClick={handleJoinCreated} className="btn-primary btn-sm">
                Join room <ArrowRight size={13} />
              </button>
              <button
                onClick={() => setCreatedRoomLink(null)}
                className="btn-ghost btn-sm"
                style={{ padding: '5px 8px' }}
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rooms-intro">
        <div>
          <span className="section-eyebrow">PULL UP A CHAIR</span>
          <h2>Find your corner.</h2>
        </div>
        <span className="rooms-count">{filteredRooms.length} {filteredRooms.length === 1 ? 'room' : 'rooms'} to explore <span>↘</span></span>
      </div>

      <div className="toolbar">
        <div className="pills">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`pill${selectedCategory === cat ? ' active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="input-wrap" style={{ width: '240px' }}>
          <Search size={14} className="input-icon" />
          <input
            type="text"
            placeholder="Search rooms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {filteredRooms.length === 0 ? (
        <div className="empty">No rooms match that filter.</div>
      ) : (
        <div className="room-grid">
          {filteredRooms.map((room) => {
            const isWork = room.pomodoro?.mode === 'work';
            const participantCount = room.participants?.length || 0;

            return (
              <div
                key={room.id}
                className="card-sleek card-interactive room-card paper-page sticky-note"
                onClick={() => onJoinRoom(room.id)}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span className="badge badge-neutral">#{room.topic}</span>
                    <span className="badge badge-neutral">{room.visibility === 'private' ? 'Private' : 'Public'}</span>
                    <span className={`badge ${isWork ? 'badge-honey' : 'badge-emerald'}`}>
                      <span className="dot" />
                      {isWork ? 'Focus' : 'Break'}
                    </span>
                  </div>

                  <h3>{room.title}</h3>
                  <p>{room.description}</p>
                </div>

                <div>
                  <div className="room-card-meta">
                    <span>Hosted by {room.hostName}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--success)' }}>
                      <Users size={13} /> {participantCount}
                    </span>
                  </div>

                  <button
                    className="btn-secondary"
                    style={{ width: '100%' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onJoinRoom(room.id);
                    }}
                  >
                    Join <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="overlay" onClick={() => setShowCreateModal(false)}>
          <div className="card-elevated modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '16px' }}>
              New study room
            </h3>

            <form onSubmit={handleCreate} className="form-stack">
              <div className="field">
                <label className="field-label">Title</label>
                <input
                  type="text"
                  placeholder="e.g. Operating Systems sprint"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
              </div>

              <div className="grid-2">
                <div className="field">
                  <label className="field-label">Topic</label>
                  <input list="study-topics"
                    type="text"
                    placeholder="e.g. Algorithms"
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    required
                  />
                  <datalist id="study-topics">{Object.entries(topicGroups).flatMap(([group,topics])=>topics.map(topic=><option key={`${group}-${topic}`} value={topic}/>))}</datalist>
                </div>

                <div className="field">
                  <label className="field-label">Category</label>
                  <input
                    value={newCategory}
                    placeholder="e.g. Science, Arts, Career prep"
                    onChange={(e) => setNewCategory(e.target.value)}
                  />
                </div>
              </div>

              <div className="field">
                <label className="field-label">Goal</label>
                <textarea
                  placeholder="What this room will focus on..."
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>

              <div className="field"><label className="field-label">Who can join?</label><div className="pills"><button type="button" className={`pill ${visibility==='public'?'active':''}`} onClick={()=>setVisibility('public')}>Public · anyone can join</button><button type="button" className={`pill ${visibility==='private'?'active':''}`} onClick={()=>setVisibility('private')}>Private · invite link only</button></div><small>Created by {currentUser?.name}</small></div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create &amp; get link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showJoinModal && (
        <div className="overlay" onClick={() => setShowJoinModal(false)}>
          <div className="card-elevated modal join-room-modal" onClick={(e) => e.stopPropagation()}>
            <span className="section-eyebrow">A SEAT IS WAITING</span>
            <h3>Join a study room</h3>
            <p>Paste the invite link someone shared with you.</p>
            <form onSubmit={handleJoinByLink} className="form-stack">
              <div className="field">
                <label className="field-label" htmlFor="join-room-link">Room link</label>
                <input
                  id="join-room-link"
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="https://…/?join=room-12345"
                  value={joinInput}
                  onChange={(e) => {
                    setJoinInput(e.target.value);
                    if (joinError) setJoinError('');
                  }}
                  autoFocus
                />
              </div>
              {joinError && <div className="alert alert-danger" role="alert">{joinError}</div>}
              <div className="form-actions">
                <button type="button" className="btn-ghost" onClick={() => setShowJoinModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isJoining}>
                  <DoorOpen size={15} /> {isJoining ? 'Finding room…' : 'Join room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
