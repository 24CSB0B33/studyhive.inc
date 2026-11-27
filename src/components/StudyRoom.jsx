import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  MessageSquare,
  BookOpen,
  ArrowLeft,
  Share2,
  Check,
  Brain,
  ChevronDown,
  ChevronUp,
  Trash2
} from 'lucide-react';
import PomodoroTimer from './PomodoroTimer';
import AIQuizArena from './AIQuizArena';
import ChatPanel from './ChatPanel';
import ResourceHub from './ResourceHub';
import { fetchRoom, fetchMessages, deleteRoom } from '../services/api';

export default function StudyRoom({
  roomId,
  inviteToken = '',
  currentUser,
  socket,
  onLeaveRoom,
  onRoomDeleted,
  selectedModel,
  onOpenGeminiModal
}) {
  const [room, setRoom] = useState(null);
  const [roomJoined, setRoomJoined] = useState(false);
  const [messages, setMessages] = useState([]);
  const [activeTab, setActiveTab] = useState('resources');
  const [copiedLink, setCopiedLink] = useState(false);
  const [prefilledNotes, setPrefilledNotes] = useState('');
  const [quizExpanded, setQuizExpanded] = useState(false);
  const [showLeavePrompt, setShowLeavePrompt] = useState(false);
  const [showDeletePrompt,setShowDeletePrompt]=useState(false);
  const quizArenaRef = useRef(null);
  const allowBrowserBackRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const roomRes = await fetchRoom(roomId, inviteToken);
        if (roomRes.success && roomRes.room && isMounted) {
          setRoom(roomRes.room);
        }
        const msgRes = await fetchMessages(roomId);
        if (msgRes.success && msgRes.messages && isMounted) {
          setMessages(msgRes.messages);
        }
      } catch (err) {
        console.error('Failed to load room:', err);
      }
    }

    loadData();

    if (socket) {
      let joinAttempted = false;
      const joinRoom = () => {
        if (joinAttempted || !socket.connected) return;
        joinAttempted = true;
        socket.emit('join-room', { roomId, inviteToken }, (ack) => {
          if (ack?.success) setRoomJoined(true);
          else { setRoomJoined(false); setShowLeavePrompt(true); }
        });
      };
      if (socket.connected) joinRoom();
      else socket.on('connect', joinRoom);

      const handleParticipantsUpdated = ({ participants }) => {
        setRoom((prev) => (prev ? { ...prev, participants } : prev));
      };

      const handlePomodoroTick = (tickData) => {
        setRoom((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            pomodoro: {
              ...prev.pomodoro,
              timeLeft: tickData.timeLeft,
              mode: tickData.mode,
              isRunning: tickData.isRunning,
              cyclesCompleted: tickData.cyclesCompleted
            }
          };
        });
      };

      const handlePomodoroUpdate = ({ pomodoro }) => {
        setRoom((prev) => (prev ? { ...prev, pomodoro } : prev));
      };

      socket.on('room-participants-updated', handleParticipantsUpdated);
      socket.on('pomodoro-tick', handlePomodoroTick);
      socket.on('pomodoro-update', handlePomodoroUpdate);
      const deleted=()=>onRoomDeleted?.();
      socket.on('room-deleted',deleted);

      return () => {
        socket.off('connect', joinRoom);
        socket.emit('leave-room', { roomId, userId: currentUser.id });
        setRoomJoined(false);
        socket.off('room-participants-updated', handleParticipantsUpdated);
        socket.off('pomodoro-tick', handlePomodoroTick);
        socket.off('pomodoro-update', handlePomodoroUpdate);
        socket.off('room-deleted',deleted);
        isMounted = false;
      };
    }
  }, [roomId, socket, currentUser, inviteToken, onRoomDeleted]);

  useEffect(() => {
    const guardState = window.history.state && typeof window.history.state === 'object'
      ? window.history.state
      : {};

    if (guardState.studyHiveRoomGuard !== roomId) {
      window.history.pushState(
        { ...guardState, studyHiveRoomGuard: roomId },
        '',
        window.location.href
      );
    }

    const handleBrowserBack = (event) => {
      if (allowBrowserBackRef.current) {
        allowBrowserBackRef.current = false;
        return;
      }

      if (event.state?.studyHiveRoomGuard === roomId) return;

      setShowLeavePrompt(true);
      const currentState = window.history.state && typeof window.history.state === 'object'
        ? window.history.state
        : {};
      window.history.pushState(
        { ...currentState, studyHiveRoomGuard: roomId },
        '',
        window.location.href
      );
    };

    window.addEventListener('popstate', handleBrowserBack);
    return () => window.removeEventListener('popstate', handleBrowserBack);
  }, [roomId]);

  useEffect(() => {
    if (!showLeavePrompt) return undefined;
    const handleEscape = (event) => {
      if (event.key === 'Escape') setShowLeavePrompt(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showLeavePrompt]);

  const handleConfirmLeave = () => {
    setShowLeavePrompt(false);
    allowBrowserBackRef.current = true;
    onLeaveRoom();
    window.history.back();
  };

  const handleCopyShareLink = () => {
    const shareLink = window.location.origin + '/?join=' + roomId + (room?.visibility==='private' ? '&invite='+encodeURIComponent(room.inviteToken||inviteToken) : '');
    navigator.clipboard.writeText(shareLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleGenerateQuizFromNote = (note) => {
    setPrefilledNotes(note.content || note.description || note.title);
    setQuizExpanded(true);
    setTimeout(() => {
      quizArenaRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="page page-compact">
      {/* Room header bar */}
      <div className="card-sleek room-topbar" style={{
        padding: '12px 16px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <button
            onClick={() => setShowLeavePrompt(true)}
            className="btn-ghost btn-sm"
          >
            <ArrowLeft size={14} /> Back
          </button>

          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
                {room?.title || 'Study room'}
              </h2>
              <span className="badge badge-neutral">#{room?.topic || 'Focus'}</span>
            </div>
            <small style={{color:'var(--text-secondary)'}}>Hosted by {room?.hostName || 'StudyHive member'} · {room?.visibility==='private'?'Private room':'Public room'}</small>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-emerald">
            <Users size={12} />
            {room?.participants?.length || 1}
          </span>

          <button
            onClick={handleCopyShareLink}
            className="btn-secondary btn-sm"
          >
            {copiedLink ? <Check size={12} /> : <Share2 size={12} />}
            {copiedLink ? 'Copied!' : 'Share'}
          </button>
          {room?.hostId===currentUser.id&&<button onClick={()=>setShowDeletePrompt(true)} className="btn-ghost btn-sm" title="Delete room"><Trash2 size={13}/> Delete</button>}
        </div>
      </div>

      <div className="room-layout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <PomodoroTimer
            room={room}
            socket={socket}
            isHost={room?.hostId === currentUser.id}
            onLaunchQuiz={() => {
              setQuizExpanded(true);
              setTimeout(() => quizArenaRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            }}
          />

          <div ref={quizArenaRef} className="card-sleek quiz-foldout" style={{ overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setQuizExpanded((v) => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '14px 18px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-primary)'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.875rem' }}>
                <Brain size={15} color="var(--ai)" />
                🧠 AI Quiz
              </span>
              {quizExpanded ? <ChevronUp size={16} color="var(--text-tertiary)" /> : <ChevronDown size={16} color="var(--text-tertiary)" />}
            </button>

            {quizExpanded && (
              <div style={{ padding: '0 4px 4px' }}>
                <AIQuizArena
                  room={room}
                  currentUser={currentUser}
                  socket={socket}
                  selectedModel={selectedModel}
                  onOpenGeminiModal={onOpenGeminiModal}
                  prefilledNotes={prefilledNotes}
                />
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="segmented">
            <button
              type="button"
              className={activeTab === 'resources' ? 'active tab-resources-active' : 'tab-resources'}
              onClick={() => setActiveTab('resources')}
            >
              <BookOpen size={13} /> Resources
            </button>
            <button
              type="button"
              className={activeTab === 'chat' ? 'active' : ''}
              onClick={() => setActiveTab('chat')}
            >
              <MessageSquare size={13} /> Chat
            </button>
            <button
              type="button"
              className={activeTab === 'peers' ? 'active' : ''}
              onClick={() => setActiveTab('peers')}
            >
              <Users size={13} /> Peers
            </button>
          </div>

          {activeTab === 'resources' && (
            <ResourceHub
              roomId={roomId}
              currentUser={currentUser}
              socket={socket}
              roomJoined={roomJoined}
              onGenerateQuizFromNote={handleGenerateQuizFromNote}
            />
          )}

          {activeTab === 'chat' && (
            <ChatPanel
              roomId={roomId}
              currentUser={currentUser}
              socket={socket}
              roomJoined={roomJoined}
              initialMessages={messages}
            />
          )}

          {activeTab === 'peers' && (
            <div className="card-sleek panel paper-page notebook-panel">
              <div className="panel-header">
                <span className="panel-title">In this room</span>
              </div>
              <div className="panel-body">
                {(room?.participants || []).map((peer) => (
                  <div key={peer.id} className="list-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{peer.avatar || '👨‍💻'}</span>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
                        {peer.name} {peer.id === currentUser.id && '(you)'}
                      </span>
                    </div>
                    <span className="badge badge-emerald">Active</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showLeavePrompt && (
        <div className="overlay leave-room-overlay" onClick={() => setShowLeavePrompt(false)}>
          <div
            className="card-elevated modal leave-room-modal paper-page"
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-room-title"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="section-eyebrow">ONE LAST PAGE?</span>
            <h3 id="leave-room-title">Leave this study room?</h3>
            <p>Your focus session will keep running for everyone else in the room.</p>
            <div className="form-actions">
              <button autoFocus className="btn-secondary" onClick={() => setShowLeavePrompt(false)}>
                Stay in room
              </button>
              <button className="btn-primary" onClick={handleConfirmLeave}>
                Leave room <ArrowLeft size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
      {showDeletePrompt&&<div className="overlay" onClick={()=>setShowDeletePrompt(false)}><div className="card-elevated modal paper-page" role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}><span className="section-eyebrow">ROOM OWNER</span><h3>Delete this study room?</h3><p>This removes the room and its shared notes for everyone. This can’t be undone.</p><div className="form-actions"><button className="btn-secondary" onClick={()=>setShowDeletePrompt(false)}>Keep room</button><button className="btn-primary" onClick={async()=>{const result=await deleteRoom(roomId);if(result.success)onRoomDeleted?.();else alert(result.message||'Could not delete room')}}><Trash2 size={14}/> Delete room</button></div></div></div>}
    </div>
  );
}
