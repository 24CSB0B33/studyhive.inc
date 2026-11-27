
import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, Bot } from 'lucide-react';

export default function ChatPanel({
  roomId,
  currentUser,
  socket,
  initialMessages = []
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg) => {
      if (msg.roomId === roomId) {
        setMessages((prev) => [...prev, msg]);
      }
    };

    socket.on('new-message', handleNewMessage);
    return () => socket.off('new-message', handleNewMessage);
  }, [socket, roomId]);

  const handleSendMessage = (textToSend = null) => {
    const text = textToSend || inputText;
    if (!text || !text.trim()) return;

    const messagePayload = {
      roomId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar || '👨‍💻',
      role: currentUser.role || 'Scholar',
      content: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    if (socket) {
      socket.emit('send-message', { roomId, message: messagePayload });
    } else {
      setMessages((prev) => [...prev, { ...messagePayload, id: 'local-' + Date.now() }]);
    }

    if (!textToSend) setInputText('');
  };

  return (
    <div className="card-sleek panel paper-page notebook-panel">
      <div className="panel-header">
        <span className="panel-title">
          <MessageSquare size={15} /> Chat
        </span>
      </div>

      <div className="panel-body" style={{ gap: '12px' }}>
        {messages.length === 0 ? (
          <div className="empty" style={{ marginTop: '40px' }}>
            No messages yet.
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUser?.id;
            const isSystem = msg.senderId === 'system';
            const isAI = msg.senderId === 'ai-agent';

            if (isSystem) {
              return (
                <div key={msg.id} style={{ textAlign: 'center' }}>
                  <span className="badge badge-neutral">{msg.content}</span>
                </div>
              );
            }

            if (isAI) {
              return (
                <div key={msg.id} className="insight" style={{ display: 'flex', gap: '8px' }}>
                  <Bot size={15} color="var(--ai)" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--ai)', marginBottom: '2px' }}>
                      Gemini · {msg.timestamp}
                    </div>
                    <div style={{ lineHeight: 1.45 }}>{msg.content}</div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isMe ? 'flex-end' : 'flex-start'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '4px',
                  fontSize: '0.7rem',
                  color: 'var(--text-tertiary)'
                }}>
                  <span>{msg.senderAvatar}</span>
                  <span>{msg.senderName}</span>
                  <span>{msg.timestamp}</span>
                </div>

                <div className={`chat-bubble ${isMe ? 'mine' : 'peer'}`}>
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="panel-footer"
      >
        <input
          type="text"
          placeholder="Message the room..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          style={{ flex: 1 }}
        />
        <button
          type="submit"
          className="btn-primary btn-icon"
          disabled={!inputText.trim()}
          aria-label="Send"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
