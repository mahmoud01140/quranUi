import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, MessageSquare, Bookmark, BookmarkPlus, Plus, Trash2,
  Play, Pause, Clock, FileText, RotateCcw, Volume2,
  ChevronDown, ChevronUp, StickyNote,
} from 'lucide-react';
import useVideoProgress from '../../hooks/useVideoProgress';

/* ═══════════════════════════════════════════════════════════
   Helpers
═══════════════════════════════════════════════════════════ */
function detectType(url) {
  if (!url) return 'unknown';
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
  if (/vimeo\.com/i.test(url))             return 'vimeo';
  return 'direct';
}

function youtubeId(url) {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([^&?#]+)/);
  return m ? m[1] : null;
}

function vimeoId(url) {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : null;
}

function fmtTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  return `${m}:${String(ss).padStart(2, '0')}`;
}

function parseTimeInput(str) {
  if (!str) return 0;
  const parts = str.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

export function isVideoUrl(url) {
  if (!url) return false;
  return /youtube\.com|youtu\.be|vimeo\.com/i.test(url) ||
         /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
}

/* ═══════════════════════════════════════════════════════════
   VideoPlayer Component
═══════════════════════════════════════════════════════════ */
export default function VideoPlayer({ url, title, onClose }) {
  const videoRef = useRef(null);

  /* ── UI state ─────────────────────────────────────────── */
  const [showPanel, setShowPanel]               = useState(false);
  const [panelTab, setPanelTab]                 = useState('notes');
  const [currentTime, setCurrentTime]           = useState(0);
  const [duration, setDuration]                 = useState(0);
  const [isPlaying, setIsPlaying]               = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [noteText, setNoteText]                 = useState('');
  const [bookmarkLabel, setBookmarkLabel]       = useState('');
  const [manualTime, setManualTime]             = useState('');

  const type    = detectType(url);
  const isDirect = type === 'direct';

  /* ── Progress hook ────────────────────────────────────── */
  const {
    progress, savePosition, saveWatchedPercentage,
    addBookmark, removeBookmark,
    addNote, removeNote, getLastPosition,
  } = useVideoProgress(url);

  /* ── Direct video events ──────────────────────────────── */
  useEffect(() => {
    if (!isDirect) return;
    const v = videoRef.current;
    if (!v) return;

    const onMeta   = () => {
      setDuration(v.duration);
      const lp = getLastPosition();
      if (lp > 10 && lp < v.duration - 5) setShowResumePrompt(true);
    };
    const onUpdate = () => setCurrentTime(v.currentTime);
    const onPlay   = () => setIsPlaying(true);
    const onPause  = () => setIsPlaying(false);

    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('timeupdate',     onUpdate);
    v.addEventListener('play',           onPlay);
    v.addEventListener('pause',          onPause);

    return () => {
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('timeupdate',     onUpdate);
      v.removeEventListener('play',           onPlay);
      v.removeEventListener('pause',          onPause);
    };
  }, [isDirect, getLastPosition]);

  /* ── Periodic save (every 5 s while playing) ──────────── */
  useEffect(() => {
    if (!isDirect || !isPlaying) return;
    const id = setInterval(() => {
      const v = videoRef.current;
      if (v && v.currentTime > 0) {
        savePosition(v.currentTime);
        if (v.duration) saveWatchedPercentage(Math.round((v.currentTime / v.duration) * 100));
      }
    }, 5000);
    return () => clearInterval(id);
  }, [isDirect, isPlaying, savePosition, saveWatchedPercentage]);

  /* ── Save on unmount ──────────────────────────────────── */
  useEffect(() => () => {
    const v = videoRef.current;
    if (v && v.currentTime > 0) savePosition(v.currentTime);
  }, [savePosition]);

  /* ── Actions ──────────────────────────────────────────── */
  const seekTo = useCallback((sec) => {
    if (isDirect && videoRef.current) {
      videoRef.current.currentTime = sec;
      setCurrentTime(sec);
    }
  }, [isDirect]);

  const handleResume = () => { seekTo(getLastPosition()); setShowResumePrompt(false); };

  const handleAddNote = () => {
    const t = isDirect ? currentTime : parseTimeInput(manualTime);
    if (!noteText.trim()) return;
    addNote(t, noteText.trim());
    setNoteText('');
    setManualTime('');
  };

  const handleAddBookmark = () => {
    const t = isDirect ? currentTime : parseTimeInput(manualTime);
    addBookmark(t, bookmarkLabel.trim() || `مرجعية ${fmtTime(t)}`);
    setBookmarkLabel('');
    setManualTime('');
  };

  /* ── Render player area ───────────────────────────────── */
  const renderVideo = () => {
    switch (type) {
      case 'youtube':
        return (
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId(url)}?rel=0`}
            className="w-full aspect-video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={title || 'فيديو'}
          />
        );
      case 'vimeo':
        return (
          <iframe
            src={`https://player.vimeo.com/video/${vimeoId(url)}`}
            className="w-full aspect-video"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            title={title || 'فيديو'}
          />
        );
      default:
        return (
          <video
            ref={videoRef}
            src={url}
            controls
            className="w-full aspect-video bg-black"
            controlsList="nodownload"
          />
        );
    }
  };

  /* ── Main render ──────────────────────────────────────── */
  return (
    <div className="halaqa video-player-wrapper rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E8E2D4' }}>

      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ background: '#FFFFFF', borderBottom: '1px solid #E8E2D4' }}>
        <h3 className="font-bold text-sm truncate flex-1 flex items-center gap-2" style={{ color: '#2A2438', margin: 0 }}>
          <Play className="w-4 h-4 flex-none" style={{ color: '#177B58' }} aria-hidden />
          {title || 'مشغل الفيديو'}
        </h3>

        <div className="flex items-center gap-1">
          {/* Toggle notes panel */}
          <button
            type="button"
            onClick={() => setShowPanel(!showPanel)}
            aria-expanded={showPanel}
            aria-label="ملاحظات ومرجعيات"
            className="transition-colors"
            style={{
              minWidth: 44, minHeight: 44, borderRadius: 12, border: 'none', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: showPanel ? '#E2EFE7' : 'transparent',
              color: showPanel ? '#177B58' : '#756E85',
            }}
            title="ملاحظات ومرجعيات"
          >
            <MessageSquare className="w-4 h-4" aria-hidden />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق المشغل"
              className="transition-colors"
              style={{
                minWidth: 44, minHeight: 44, borderRadius: 12, border: 'none', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent', color: '#756E85',
              }}
            >
              <X className="w-4 h-4" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row">

        {/* Video area */}
        <div className={`${showPanel ? 'lg:w-2/3' : 'w-full'}`}>
          {renderVideo()}

          {/* Bookmark markers bar (direct video only) */}
          {isDirect && duration > 0 && progress?.bookmarks?.length > 0 && (
            <div className="relative" style={{ height: 6, background: '#E8E2D4' }}>
              {progress.bookmarks.map((b) => (
                <div
                  key={b.id}
                  role="button" tabIndex={0}
                  aria-label={`مرجعية: ${b.label}`}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); seekTo(b.time); } }}
                  className="absolute rounded-full cursor-pointer"
                  style={{
                    width: 10, height: 10, top: -2, background: '#177B58',
                    border: '2px solid #fff', boxShadow: '0 1px 4px rgba(42,36,56,0.25)', zIndex: 10,
                    left: `${Math.min((b.time / duration) * 100, 99)}%`,
                  }}
                  onClick={() => seekTo(b.time)}
                  title={`${b.label} — ${fmtTime(b.time)}`}
                />
              ))}
            </div>
          )}

          {/* Resume prompt */}
          <AnimatePresence>
            {showResumePrompt && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-2.5"
                  style={{ background: '#FBF7EE', borderTop: '1px solid #E8E2D4' }}>
                  <div className="flex items-center gap-2 text-sm">
                    <RotateCcw className="w-4 h-4" style={{ color: '#177B58' }} aria-hidden />
                    <span className="font-medium" style={{ color: '#2A2438' }}>
                      أكملت حتى <span className="font-bold" style={{ color: '#177B58' }}>{fmtTime(getLastPosition())}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResume}
                      className="text-xs font-bold px-3"
                      style={{ minHeight: 44, background: '#177B58', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
                    >
                      استئناف
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowResumePrompt(false)}
                      className="text-xs font-bold px-3"
                      style={{ minHeight: 44, background: 'none', border: 'none', cursor: 'pointer', color: '#756E85' }}
                    >
                      من البداية
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick actions bar */}
          <div className="flex items-center justify-between px-4 py-2" style={{ borderTop: '1px solid #E8E2D4', background: '#FBF7EE' }}>
            {isDirect ? (
              <span className="text-xs flex items-center gap-1" style={{ color: '#756E85', fontVariantNumeric: 'tabular-nums' }}>
                <Clock className="w-3 h-3" aria-hidden /> {fmtTime(currentTime)} / {fmtTime(duration)}
              </span>
            ) : (
              <span className="text-xs" style={{ color: '#756E85' }}>
                {type === 'youtube' ? 'YouTube' : type === 'vimeo' ? 'Vimeo' : 'فيديو'}
              </span>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setShowPanel(true); setPanelTab('bookmarks'); handleAddBookmark(); }}
                className="text-xs font-bold flex items-center gap-1 px-2 py-1 rounded-lg"
                style={{ minHeight: 44, color: '#177B58', background: 'none', border: 'none', cursor: 'pointer' }}
                title="إضافة مرجعية هنا"
              >
                <BookmarkPlus className="w-3.5 h-3.5" aria-hidden /> مرجعية
              </button>
              <button
                type="button"
                onClick={() => { setShowPanel(true); setPanelTab('notes'); }}
                className="text-xs font-bold flex items-center gap-1 px-2 py-1 rounded-lg"
                style={{ minHeight: 44, color: '#177B58', background: 'none', border: 'none', cursor: 'pointer' }}
                title="إضافة ملاحظة"
              >
                <StickyNote className="w-3.5 h-3.5" aria-hidden /> ملاحظة
              </button>
            </div>
          </div>
        </div>

        {/* ── Side panel (notes & bookmarks) ─────────────── */}
        <AnimatePresence>
          {showPanel && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="halaqa lg:w-1/3 w-full flex flex-col max-h-[500px] min-w-0 lg:min-w-[280px]"
              style={{ borderTop: '1px solid #E8E2D4', background: '#FBF7EE' }}
            >
              {/* Tabs */}
              <div className="flex flex-none" style={{ borderBottom: '1px solid #E8E2D4' }}>
                <button
                  type="button"
                  onClick={() => setPanelTab('notes')}
                  aria-selected={panelTab === 'notes'}
                  className="flex-1 text-xs font-bold flex items-center justify-center gap-1.5"
                  style={{
                    minHeight: 48, background: 'none', border: 'none', cursor: 'pointer',
                    borderBottom: `2px solid ${panelTab === 'notes' ? '#177B58' : 'transparent'}`,
                    color: panelTab === 'notes' ? '#177B58' : '#756E85',
                  }}
                >
                  <FileText className="w-3.5 h-3.5" aria-hidden />
                  ملاحظات ({progress?.notes?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setPanelTab('bookmarks')}
                  aria-selected={panelTab === 'bookmarks'}
                  className="flex-1 text-xs font-bold flex items-center justify-center gap-1.5"
                  style={{
                    minHeight: 48, background: 'none', border: 'none', cursor: 'pointer',
                    borderBottom: `2px solid ${panelTab === 'bookmarks' ? '#177B58' : 'transparent'}`,
                    color: panelTab === 'bookmarks' ? '#177B58' : '#756E85',
                  }}
                >
                  <Bookmark className="w-3.5 h-3.5" aria-hidden />
                  مرجعيات ({progress?.bookmarks?.length || 0})
                </button>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {panelTab === 'notes' ? (
                  progress?.notes?.length > 0 ? (
                    progress.notes.map((n) => (
                      <div
                        key={n.id}
                        className="rounded-xl p-3 group"
                        style={{ background: '#FFFFFF', border: '1px solid #E8E2D4' }}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <button
                            type="button"
                            onClick={() => seekTo(n.time)}
                            className="font-bold"
                            style={{
                              fontSize: '0.8125rem', padding: '6px 12px', borderRadius: 9999, cursor: 'pointer',
                              background: '#E2EFE7', color: '#0F5940', border: 'none', fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {fmtTime(n.time)}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeNote(n.id)}
                            aria-label="حذف الملاحظة"
                            className="inline-flex items-center justify-center"
                            style={{ minWidth: 44, minHeight: 44, borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', color: '#C2410C' }}
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden />
                          </button>
                        </div>
                        <p className="text-xs" style={{ color: '#2A2438', lineHeight: 1.8, margin: 0 }}>{n.text}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8" style={{ color: '#756E85' }}>
                      <FileText className="w-8 h-8 mx-auto mb-2" style={{ color: '#E8E2D4' }} aria-hidden />
                      <p className="text-xs" style={{ margin: 0 }}>لا توجد ملاحظات بعد</p>
                    </div>
                  )
                ) : (
                  progress?.bookmarks?.length > 0 ? (
                    progress.bookmarks.map((b) => (
                      <div
                        key={b.id}
                        className="rounded-xl p-3 group flex items-center gap-2"
                        style={{ background: '#FFFFFF', border: '1px solid #E8E2D4' }}
                      >
                        <button
                          type="button"
                          onClick={() => seekTo(b.time)}
                          className="font-bold flex-none"
                          style={{
                            fontSize: '0.8125rem', padding: '6px 12px', borderRadius: 9999, cursor: 'pointer',
                            background: '#E2EFE7', color: '#0F5940', border: 'none', fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {fmtTime(b.time)}
                        </button>
                        <span className="text-xs flex-1 truncate" style={{ color: '#2A2438' }}>{b.label}</span>
                        <button
                          type="button"
                          onClick={() => removeBookmark(b.id)}
                          aria-label="حذف العلامة"
                          className="inline-flex items-center justify-center flex-none"
                          style={{ minWidth: 40, minHeight: 40, borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', color: '#C2410C' }}
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8" style={{ color: '#756E85' }}>
                      <Bookmark className="w-8 h-8 mx-auto mb-2" style={{ color: '#E8E2D4' }} aria-hidden />
                      <p className="text-xs" style={{ margin: 0 }}>لا توجد مرجعيات بعد</p>
                    </div>
                  )
                )}
              </div>

              {/* Add form */}
              <div className="p-3 flex-none" style={{ borderTop: '1px solid #E8E2D4', background: '#FFFFFF' }}>
                {panelTab === 'notes' ? (
                  <div className="space-y-2">
                    {!isDirect && (
                      <input
                        type="text"
                        placeholder="الوقت (مثال: 5:30)"
                        value={manualTime}
                        onChange={(e) => setManualTime(e.target.value)}
                        aria-label="وقت الملاحظة"
                        className="w-full text-xs focus:border-[#177B58] focus:outline-none text-right"
                        style={{ minHeight: 44, background: '#FFFFFF', border: '1px solid #E8E2D4', color: '#2A2438', borderRadius: 8, padding: '8px 12px', direction: 'ltr' }}
                      />
                    )}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder={isDirect ? `ملاحظة عند ${fmtTime(currentTime)}` : 'اكتب ملاحظة...'}
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                        aria-label="نص الملاحظة"
                        className="flex-1 text-xs focus:border-[#177B58] focus:outline-none text-right"
                        style={{ minHeight: 44, background: '#FFFFFF', border: '1px solid #E8E2D4', color: '#2A2438', borderRadius: 8, padding: '8px 12px' }}
                      />
                      <button
                        type="button"
                        onClick={handleAddNote}
                        disabled={!noteText.trim()}
                        aria-label="إضافة ملاحظة"
                        className="flex-none"
                        style={{ minWidth: 48, minHeight: 44, background: '#177B58', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: !noteText.trim() ? 0.45 : 1 }}
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {!isDirect && (
                      <input
                        type="text"
                        placeholder="الوقت (مثال: 5:30)"
                        value={manualTime}
                        onChange={(e) => setManualTime(e.target.value)}
                        aria-label="وقت المرجعية"
                        className="w-full text-xs focus:border-[#177B58] focus:outline-none text-right"
                        style={{ minHeight: 44, background: '#FFFFFF', border: '1px solid #E8E2D4', color: '#2A2438', borderRadius: 8, padding: '8px 12px', direction: 'ltr' }}
                      />
                    )}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder={isDirect ? `مرجعية عند ${fmtTime(currentTime)}` : 'عنوان المرجعية...'}
                        value={bookmarkLabel}
                        onChange={(e) => setBookmarkLabel(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddBookmark()}
                        aria-label="عنوان المرجعية"
                        className="flex-1 text-xs focus:border-[#177B58] focus:outline-none text-right"
                        style={{ minHeight: 44, background: '#FFFFFF', border: '1px solid #E8E2D4', color: '#2A2438', borderRadius: 8, padding: '8px 12px' }}
                      />
                      <button
                        type="button"
                        onClick={handleAddBookmark}
                        aria-label="إضافة مرجعية"
                        className="flex-none"
                        style={{ minWidth: 48, minHeight: 44, background: '#177B58', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <BookmarkPlus className="w-3.5 h-3.5" aria-hidden />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
