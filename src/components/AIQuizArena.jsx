// src/components/AIQuizArena.jsx
import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  RotateCcw,
  Loader2,
  Flame,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { generateQuiz } from '../services/api';
import { playCorrectSound, playChime } from '../utils/audio';

export default function AIQuizArena({
  room,
  currentUser,
  socket,
  selectedModel,
  onOpenGeminiModal,
  prefilledNotes = ''
}) {
  const [topic, setTopic] = useState(room?.topic || 'Operating Systems');
  const [notesContext, setNotesContext] = useState(prefilledNotes || '');
  const [difficulty, setDifficulty] = useState('Medium');
  const [questionCount, setQuestionCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [quizData, setQuizData] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [questionTimer, setQuestionTimer] = useState(30);
  const [isQuizCompleted, setIsQuizCompleted] = useState(false);
  const [userAnswers, setUserAnswers] = useState([]);
  const [roomLeaderboard, setRoomLeaderboard] = useState({});
  const [showReview, setShowReview] = useState(false);

  useEffect(() => {
    if (prefilledNotes) {
      setNotesContext(prefilledNotes);
    }
  }, [prefilledNotes]);

  const handleOptionSelect = useCallback((optionIdx, isTimeout = false) => {
    if (isAnswerSubmitted || !quizData) return;

    const currentQ = quizData.questions[currentIndex];
    if (!currentQ) return;
    const isCorrect = !isTimeout && optionIdx === currentQ.answerIndex;

    setSelectedOption(optionIdx);
    setIsAnswerSubmitted(true);

    if (isCorrect) {
      setScore((prev) => prev + 1);
      setStreak((prev) => prev + 1);
      playCorrectSound();
    } else {
      setStreak(0);
    }

    setUserAnswers((prev) => [
      ...prev,
      {
        questionId: currentQ.id,
        question: currentQ.question,
        options: currentQ.options,
        chosenIndex: optionIdx,
        correctIndex: currentQ.answerIndex,
        isCorrect,
        explanation: currentQ.explanation
      }
    ]);
  }, [isAnswerSubmitted, quizData, currentIndex]);

  useEffect(() => {
    if (!quizData || isAnswerSubmitted || isQuizCompleted) return;

    const handleKeyDown = (e) => {
      if (['1', '2', '3', '4'].includes(e.key)) {
        handleOptionSelect(parseInt(e.key, 10) - 1);
      } else if (['a', 'b', 'c', 'd'].includes(e.key.toLowerCase())) {
        const map = { a: 0, b: 1, c: 2, d: 3 };
        handleOptionSelect(map[e.key.toLowerCase()]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quizData, isAnswerSubmitted, isQuizCompleted, handleOptionSelect]);

  useEffect(() => {
    if (!socket) return;

    const handleRoomQuizStarted = ({ quiz }) => {
      if (quiz && quiz.questions && quiz.questions.length > 0) {
        setQuizData(quiz);
        setCurrentIndex(0);
        setSelectedOption(null);
        setIsAnswerSubmitted(false);
        setScore(0);
        setStreak(0);
        setUserAnswers([]);
        setIsQuizCompleted(false);
        setQuestionTimer(30);
        playChime();
      }
    };

    const handleLeaderboardUpdate = ({ scores }) => {
      if (scores) setRoomLeaderboard(scores);
    };

    socket.on('room-quiz-started', handleRoomQuizStarted);
    socket.on('quiz-leaderboard-update', handleLeaderboardUpdate);

    return () => {
      socket.off('room-quiz-started', handleRoomQuizStarted);
      socket.off('quiz-leaderboard-update', handleLeaderboardUpdate);
    };
  }, [socket]);

  useEffect(() => {
    let interval = null;
    if (quizData && !isAnswerSubmitted && !isQuizCompleted && questionTimer > 0) {
      interval = setInterval(() => {
        setQuestionTimer((prev) => {
          if (prev <= 1) {
            handleOptionSelect(-1, true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [quizData, isAnswerSubmitted, isQuizCompleted, questionTimer, handleOptionSelect]);

  const handleGenerate = async (e) => {
    if (e) e.preventDefault();
    if (!topic.trim()) {
      setErrorMessage('Please enter a study topic.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const res = await generateQuiz({
        topic: topic.trim(),
        notesContext: notesContext.trim(),
        difficulty,
        questionCount,
        model: selectedModel
      });

      if (res && res.success && res.questions && res.questions.length > 0) {
        const payload = {
          topic: res.topic || topic,
          difficulty: res.difficulty || difficulty,
          questions: res.questions,
          source: res.source
        };

        if (socket && room?.id) {
          socket.emit('start-room-quiz', {
            roomId: room.id,
            quizData: payload,
            initiatedBy: currentUser?.name || 'Peer'
          });
        } else {
          setQuizData(payload);
          setCurrentIndex(0);
          setSelectedOption(null);
          setIsAnswerSubmitted(false);
          setScore(0);
          setStreak(0);
          setUserAnswers([]);
          setIsQuizCompleted(false);
          setQuestionTimer(30);
        }
      } else {
        setErrorMessage(res.message || 'Could not generate questions. Please try again.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Quiz generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex + 1 < quizData.questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswerSubmitted(false);
      setQuestionTimer(30);
    } else {
      setIsQuizCompleted(true);
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });

      if (socket && room?.id) {
        socket.emit('submit-quiz-score', {
          roomId: room.id,
          quizId: quizData.id,
          user: currentUser,
          score: score + (selectedOption === quizData.questions[currentIndex]?.answerIndex ? 1 : 0),
          totalQuestions: quizData.questions.length
        });
      }
    }
  };

  const handleResetQuiz = () => {
    setQuizData(null);
    setIsQuizCompleted(false);
    setSelectedOption(null);
    setIsAnswerSubmitted(false);
    setScore(0);
    setStreak(0);
    setUserAnswers([]);
  };

  const currentQuestion = quizData?.questions?.[currentIndex];

  return (
    <div style={{ padding: '4px 20px 20px' }}>
      {!quizData && (
        <div>
          <form onSubmit={handleGenerate} className="form-stack">
            <div className="field">
              <label className="field-label">Topic</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Process scheduling"
                required
              />
            </div>

            <div className="grid-2">
              <div className="field">
                <label className="field-label">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>

              <div className="field">
                <label className="field-label">Questions</label>
                <select
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                >
                  <option value={3}>3</option>
                  <option value={5}>5</option>
                  <option value={8}>8</option>
                </select>
              </div>
            </div>

            {notesContext && (
              <div className="field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="field-label">Notes attached</label>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => setNotesContext('')}
                  >
                    Clear
                  </button>
                </div>
                <div className="list-row" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxHeight: '72px', overflowY: 'auto', alignItems: 'flex-start' }}>
                  {notesContext}
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="alert alert-danger">{errorMessage}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-ai"
              style={{ width: '100%' }}
            >
              {loading ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
              {loading ? 'Generating…' : 'Start room quiz'}
            </button>
          </form>
        </div>
      )}

      {quizData && !isQuizCompleted && currentQuestion && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge badge-neutral">#{quizData.topic}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {currentIndex + 1} / {quizData.questions.length}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {streak > 1 && (
                <span className="badge badge-honey">
                  <Flame size={12} /> {streak}x
                </span>
              )}
              <span className="badge badge-neutral" style={{ color: questionTimer <= 10 ? 'var(--danger)' : undefined }}>
                <Clock size={12} /> {questionTimer}s
              </span>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 600, lineHeight: 1.45 }}>
              {currentQuestion.question}
            </h4>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {currentQuestion.options.map((opt, idx) => {
              const letter = String.fromCharCode(65 + idx);
              const isSelected = selectedOption === idx;
              const isCorrectAnswer = idx === currentQuestion.answerIndex;

              let state = '';
              if (isAnswerSubmitted) {
                if (isCorrectAnswer) state = 'correct';
                else if (isSelected) state = 'wrong';
              } else if (isSelected) {
                state = 'selected';
              }

              return (
                <div
                  key={idx}
                  className={`quiz-option ${state}`}
                  onClick={() => !isAnswerSubmitted && handleOptionSelect(idx)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                      {letter}
                    </span>
                    <span>{opt}</span>
                  </div>

                  {isAnswerSubmitted && isCorrectAnswer && <CheckCircle2 size={16} />}
                  {isAnswerSubmitted && isSelected && !isCorrectAnswer && <XCircle size={16} />}
                </div>
              );
            })}
          </div>

          {isAnswerSubmitted && currentQuestion.explanation && (
            <div className="insight" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--ai)', marginBottom: '4px', fontSize: '0.75rem' }}>
                <Sparkles size={13} /> Insight
              </div>
              <p style={{ lineHeight: 1.5 }}>{currentQuestion.explanation}</p>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              Score <strong style={{ color: 'var(--success)' }}>{score}</strong>
            </span>

            {isAnswerSubmitted && (
              <button
                onClick={handleNextQuestion}
                className="btn-primary"
              >
                <span>{currentIndex + 1 === quizData.questions.length ? 'Finish' : 'Next'}</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      )}


      {isQuizCompleted && (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '4px' }}>
            Done
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            {quizData.topic}
          </p>

          <div className="card-sleek" style={{
            padding: '16px',
            maxWidth: '280px',
            margin: '0 auto 16px'
          }}>
            <div className="mono" style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--accent)' }}>
              {score} / {quizData.questions.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              {Math.round((score / quizData.questions.length) * 100)}% correct
            </div>
          </div>

          {userAnswers.length > 0 && (
            <div style={{ maxWidth: '420px', margin: '0 auto 16px', textAlign: 'left' }}>
              <button
                type="button"
                onClick={() => setShowReview(!showReview)}
                className="btn-secondary"
                style={{ width: '100%', justifyContent: 'space-between', padding: '8px 12px', fontSize: '0.8rem' }}
              >
                <span>Review Explanations ({userAnswers.length})</span>
                {showReview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showReview && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                  {userAnswers.map((ans, idx) => (
                    <div
                      key={idx}
                      className="list-row"
                      style={{
                        flexDirection: 'column',
                        alignItems: 'stretch',
                        fontSize: '0.78rem',
                        borderColor: ans.isCorrect ? 'var(--success-border)' : 'var(--danger-border)'
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                        {idx + 1}. {ans.question}
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '6px' }}>
                        Your answer: <strong style={{ color: ans.isCorrect ? 'var(--success)' : 'var(--danger)' }}>{ans.chosenIndex >= 0 ? ans.options[ans.chosenIndex] : 'Timed out'}</strong>
                        {!ans.isCorrect && <span> (Correct: {ans.options[ans.correctIndex]})</span>}
                      </div>
                      <div style={{ color: 'var(--ai)', fontSize: '0.75rem', lineHeight: 1.4 }}>
                        {ans.explanation}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {Object.keys(roomLeaderboard).length > 0 && (
            <div style={{ maxWidth: '420px', margin: '0 auto 16px', textAlign: 'left' }}>
              <div className="field-label" style={{ marginBottom: '8px' }}>
                Leaderboard
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {Object.entries(roomLeaderboard).map(([userId, data], rank) => (
                  <div key={userId} className="list-row" style={{ fontSize: '0.8rem' }}>
                    <span>#{rank + 1} {data.name}</span>
                    <strong style={{ color: 'var(--success)' }}>{data.score} / {data.totalQuestions}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleResetQuiz}
            className="btn-primary"
          >
            <RotateCcw size={14} /> New quiz
          </button>
        </div>
      )}
    </div>
  );
}
