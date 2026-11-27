import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Coffee, Flame, Volume2, VolumeX, Sparkles } from 'lucide-react';
import { ambientPlayer } from '../utils/audio';

export default function PomodoroTimer({
  room,
  socket,
  isHost = false,
  onLaunchQuiz
}) {
  const [ambientSound, setAmbientSound] = useState('none');
  const [volume, setVolume] = useState(0.2);

  const pomodoro = room?.pomodoro || {
    mode: 'work',
    timeLeft: 25 * 60,
    workDuration: 25 * 60,
    breakDuration: 5 * 60,
    isRunning: false,
    cyclesCompleted: 0
  };

  const minutes = Math.floor(pomodoro.timeLeft / 60);
  const seconds = pomodoro.timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const totalTime = pomodoro.mode === 'work'
    ? (pomodoro.workDuration || 25 * 60)
    : (pomodoro.mode === 'shortBreak' ? 5 * 60 : 15 * 60);

  const progress = Math.min(100, Math.max(0, ((totalTime - pomodoro.timeLeft) / totalTime) * 100));

  const handleAmbientChange = (type) => {
    if (type === ambientSound) {
      ambientPlayer.stop();
      setAmbientSound('none');
    } else {
      ambientPlayer.start(type, volume);
      setAmbientSound(type);
    }
  };

  const handleVolumeChange = (e) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    ambientPlayer.setVolume(v);
  };

  const sendControl = React.useCallback((action, mode = null, customMinutes = null) => {
    if (!isHost || !socket || !room?.id) return;
    socket.emit('pomodoro-control', {
      roomId: room.id,
      action,
      mode,
      customMinutes
    });
  }, [isHost, socket, room?.id]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isHost && e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        sendControl(pomodoro.isRunning ? 'pause' : 'start');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHost, pomodoro.isRunning, sendControl]);

  useEffect(() => () => {
    ambientPlayer.stop();
  }, []);

  const isWork = pomodoro.mode === 'work';

  return (
    <div className="card-sleek paper-page focus-timer-card" style={{ padding: '22px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className={`badge ${isWork ? 'badge-honey' : 'badge-emerald'}`}>
            {isWork ? <Flame size={12} /> : <Coffee size={12} />}
            {isWork ? 'Focus' : (pomodoro.mode === 'shortBreak' ? 'Short break' : 'Long break')}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
            Cycle {pomodoro.cyclesCompleted + 1}
          </span>
        </div>

        <div className="pills">
          <button
            type="button"
            className={`pill${isWork ? ' active' : ''}`}
            disabled={!isHost}
            onClick={() => sendControl('switch-mode', 'work', 25)}
          >
            25m
          </button>
          <button
            type="button"
            className={`pill${pomodoro.mode === 'shortBreak' ? ' active' : ''}`}
            disabled={!isHost}
            onClick={() => sendControl('switch-mode', 'shortBreak', 5)}
          >
            5m
          </button>
          <button
            type="button"
            className={`pill${pomodoro.mode === 'longBreak' ? ' active' : ''}`}
            disabled={!isHost}
            onClick={() => sendControl('switch-mode', 'longBreak', 15)}
          >
            15m
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <div className="mono" style={{
          fontSize: '3.4rem',
          fontWeight: 600,
          letterSpacing: '-0.05em',
          lineHeight: 1,
          color: 'var(--text-primary)'
        }}>
          {formattedTime}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {pomodoro.isRunning ? (
            <button
              onClick={() => sendControl('pause')}
              className="btn-secondary"
              disabled={!isHost}
            >
              <Pause size={14} /> Pause
            </button>
          ) : (
            <button
              onClick={() => sendControl('start')}
              className="btn-primary"
              disabled={!isHost}
            >
              <Play size={14} fill="currentColor" /> Start
            </button>
          )}

          <button
            onClick={() => sendControl('reset')}
            className="btn-ghost btn-icon"
            title="Reset timer"
            disabled={!isHost}
          >
            <RotateCcw size={15} />
          </button>

          <button
            onClick={onLaunchQuiz}
            className="btn-ai btn-sm"
          >
            <Sparkles size={13} /> Quiz
          </button>
        </div>
      </div>

      <div className={`progress${!isWork ? ' success' : ''}`} style={{ margin: '16px 0 14px' }}>
        <span style={{ width: `${progress}%` }} />
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.75rem',
        color: 'var(--text-tertiary)',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {ambientSound !== 'none' ? <Volume2 size={13} color="var(--accent)" /> : <VolumeX size={13} />}
          <button
            type="button"
            className={`pill${ambientSound === 'rain' ? ' active' : ''}`}
            onClick={() => handleAmbientChange('rain')}
          >
            Rain
          </button>
          <button
            type="button"
            className={`pill${ambientSound === 'whitenoise' ? ' active' : ''}`}
            onClick={() => handleAmbientChange('whitenoise')}
          >
            Noise
          </button>
          {ambientSound !== 'none' && (
            <input
              type="range"
              min="0"
              max="0.4"
              step="0.02"
              value={volume}
              onChange={handleVolumeChange}
              style={{ width: '72px' }}
            />
          )}
        </div>

        <span>{isHost ? <><kbd>Space</kbd> play / pause</> : 'Only the room host can control the timer.'}</span>
      </div>
    </div>
  );
}
