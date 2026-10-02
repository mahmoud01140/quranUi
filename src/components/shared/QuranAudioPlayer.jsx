import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, SkipBack, SkipForward, Square,
  Volume2, VolumeX, Repeat, Mic, Settings,
  ChevronUp, ChevronDown, Loader2, Minus, Plus,
  ChevronsRight, ChevronsLeft,
} from 'lucide-react';
import { RECITERS, PLAYBACK_RATES } from '../../hooks/useQuranAudio';
import '../../components/halaqa/halaqa.css';
import { HQ } from '../../components/halaqa/primitives';

// ─── Play-mode config ────────────────────────────────────────
const PLAY_MODES = [
  { id: 'continuous',     label: 'متواصل',          icon: Play },
  { id: 'repeat',         label: 'تكرار',           icon: Repeat },
  { id: 'listen-repeat',  label: 'استماع ثم ترديد', icon: Mic },
];

// ─── Component ───────────────────────────────────────────────
export default function QuranAudioPlayer({ audio, surahName, totalSurahVerses }) {
  const [showSettings, setShowSettings] = useState(false);

  const {
    isPlaying, currentVerseNumber, reciter, playbackRate,
    isLoadingAudio, playMode, repeatCount, currentRepeat,
    repeatRange, isPausedForRepeat, audioProgress, volume,
    totalVerses,
    togglePlayPause, nextVerse, prevVerse, stop, playAll,
    changeReciter, changePlaybackRate, changeVolume,
    changePlayMode, changeRepeatCount, changeRepeatRange,
    continueAfterRepeat, seekTo,
  } = audio;

  const isActive   = currentVerseNumber > 0;
  const verseCount = totalSurahVerses || totalVerses;

  /* ── Progress bar click handler ───────────────────────────── */
  const handleProgressClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    // RTL: progress goes right-to-left
    const clickX = e.clientX - rect.left;
    const pct    = (clickX / rect.width) * 100;
    seekTo(pct);
  };

  const iconBtn = {
    minWidth: 44, minHeight: 44, borderRadius: 12, border: 'none', background: 'transparent',
    color: HQ.MUTED, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <div className="halaqa fixed bottom-0 left-0 right-0 z-50"
      style={{ background: HQ.SURFACE, borderTop: `1px solid ${HQ.LINE}` }}>

      {/* ── Listen-repeat overlay ───────────────────────────── */}
      <AnimatePresence>
        {isPausedForRepeat && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="px-4 py-3 flex items-center justify-between gap-3"
            style={{ background: HQ.MENTOR, color: '#fff' }}
          >
            <div className="flex items-center gap-2">
              <Mic size={19} className="animate-pulse" aria-hidden />
              <span className="font-bold text-sm">دورك الآن! رددّ الآية ثم اضغط التالي</span>
            </div>
            <button
              type="button"
              onClick={continueAfterRepeat}
              className="flex items-center gap-1.5 px-4 text-sm font-bold"
              style={{
                minHeight: 44, borderRadius: 12, cursor: 'pointer',
                background: 'transparent', color: '#fff', border: '1.5px solid #fff',
              }}
            >
              التالي <ChevronsLeft size={15} aria-hidden />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Progress bar ────────────────────────────────────── */}
      <div
        className="relative cursor-pointer m-seek"
        style={{ height: 6, background: HQ.LINE, padding: '9px 0', backgroundClip: 'content-box' }}
        onClick={handleProgressClick}
        role="slider" aria-label="تقدم التلاوة" aria-valuenow={Math.round(audioProgress)}
        aria-valuemin={0} aria-valuemax={100} tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'ArrowLeft') seekTo(Math.max(0, audioProgress - 5));
          if (e.key === 'ArrowRight') seekTo(Math.min(100, audioProgress + 5));
        }}
      >
        <div
          className="h-full relative"
          style={{ width: `${audioProgress}%`, background: HQ.MENTOR, borderRadius: 9999 }}
        >
          {/* Seek thumb — always visible so touch users see the handle */}
          <div aria-hidden style={{
            position: 'absolute', left: 0, top: '50%', transform: 'translate(-50%,-50%)',
            width: 14, height: 14, borderRadius: 9999, background: HQ.MENTOR,
            border: '2px solid #fff', boxShadow: '0 1px 4px rgba(42,36,56,0.25)',
          }} />
        </div>
      </div>

      {/* ── Main controls row ───────────────────────────────── */}
      <div className="px-3 sm:px-5 py-2.5 flex items-center justify-between gap-2">

        {/* Left: Surah / verse info */}
        <div className="flex items-center gap-2 min-w-0">
          {isLoadingAudio ? (
            <Loader2 size={15} className="animate-spin flex-none" color={HQ.MENTOR} aria-hidden />
          ) : (
            <span aria-hidden className={`flex-none ${isPlaying ? 'hq-live-dot' : ''}`}
              style={isPlaying ? undefined : { width: 8, height: 8, borderRadius: 9999, background: HQ.LINE }} />
          )}
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-bold truncate leading-tight" style={{ color: HQ.INK, margin: 0 }}>
              {surahName ? `سورة ${surahName}` : 'المشغل الصوتي'}
            </p>
            {isActive && (
              <p className="leading-tight" style={{ fontSize: '0.8125rem', color: HQ.MUTED, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                آية {currentVerseNumber} من {verseCount}
              </p>
            )}
          </div>
        </div>

        {/* Center: Transport controls */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Prev */}
          <button
            type="button"
            onClick={prevVerse}
            disabled={!isActive || currentVerseNumber <= 1}
            style={{ ...iconBtn, opacity: (!isActive || currentVerseNumber <= 1) ? 0.35 : 1 }}
            title="الآية السابقة"
          >
            <SkipForward size={19} aria-hidden />
          </button>

          {/* Play / Pause */}
          <button
            type="button"
            onClick={togglePlayPause}
            disabled={isLoadingAudio || totalVerses === 0}
            aria-label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
            title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
            style={{
              width: 52, height: 52, borderRadius: 16, border: 'none', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: HQ.MENTOR, color: '#fff',
              opacity: (isLoadingAudio || totalVerses === 0) ? 0.45 : 1,
            }}
          >
            {isLoadingAudio ? (
              <Loader2 size={21} className="animate-spin" aria-hidden />
            ) : isPlaying ? (
              <Pause size={21} aria-hidden />
            ) : (
              <Play size={21} aria-hidden />
            )}
          </button>

          {/* Next */}
          <button
            type="button"
            onClick={nextVerse}
            disabled={!isActive || currentVerseNumber >= verseCount}
            style={{ ...iconBtn, opacity: (!isActive || currentVerseNumber >= verseCount) ? 0.35 : 1 }}
            title="الآية التالية"
          >
            <SkipBack size={19} aria-hidden />
          </button>

          {/* Stop */}
          {isActive && (
            <button
              type="button"
              onClick={stop}
              style={{ ...iconBtn, color: '#C2410C' }}
              title="إيقاف"
              aria-label="إيقاف التشغيل"
            >
              <Square size={15} aria-hidden />
            </button>
          )}
        </div>

        {/* Right: Settings toggle */}
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          aria-expanded={showSettings}
          aria-label="إعدادات المشغل"
          title="إعدادات المشغل"
          style={{
            ...iconBtn,
            background: showSettings ? '#E2EFE7' : 'transparent',
            color: showSettings ? HQ.MENTOR : HQ.MUTED,
          }}
        >
          <Settings size={19} aria-hidden />
          {showSettings
            ? <ChevronDown size={12} aria-hidden className="inline mr-0.5" />
            : <ChevronUp size={12} aria-hidden className="inline mr-0.5" />
          }
        </button>
      </div>

      {/* ── Expandable settings panel ───────────────────────── */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
            style={{ borderTop: `1px solid ${HQ.LINE}` }}
          >
            <div className="px-3 sm:px-5 py-3 space-y-3">

              {/* Row 1: Reciter + Speed */}
              <div className="flex flex-wrap gap-3 items-end">
                {/* Reciter */}
                <div className="flex-1 min-w-[160px]">
                  <label htmlFor="qa-reciter" className="block mb-1" style={{ fontSize: '0.8125rem', fontWeight: 700, color: HQ.MUTED }}>القارئ</label>
                  <select
                    id="qa-reciter"
                    value={reciter}
                    onChange={(e) => changeReciter(e.target.value)}
                    className="w-full text-sm focus:border-[#177B58] focus:outline-none"
                    style={{
                      minHeight: 44, background: HQ.SURFACE, color: HQ.INK,
                      border: `1px solid ${HQ.LINE}`, borderRadius: 12, padding: '8px 12px', cursor: 'pointer',
                    }}
                  >
                    {RECITERS.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                {/* Speed */}
                <div>
                  <span className="block mb-1" style={{ fontSize: '0.8125rem', fontWeight: 700, color: HQ.MUTED }} id="qa-speed">السرعة</span>
                  <div className="flex gap-1" role="group" aria-labelledby="qa-speed">
                    {PLAYBACK_RATES.map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => changePlaybackRate(rate)}
                        aria-pressed={playbackRate === rate}
                        className="text-xs font-bold"
                        style={{
                          minWidth: 44, minHeight: 44, padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                          border: `1px solid ${playbackRate === rate ? HQ.MENTOR : HQ.LINE}`,
                          background: playbackRate === rate ? HQ.MENTOR : HQ.SURFACE,
                          color: playbackRate === rate ? '#fff' : HQ.MUTED, fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Volume */}
                <div className="hidden sm:block">
                  <span className="block mb-1" style={{ fontSize: '0.8125rem', fontWeight: 700, color: HQ.MUTED }} id="qa-vol">الصوت</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => changeVolume(volume > 0 ? 0 : 1)}
                      aria-label={volume === 0 ? 'تشغيل الصوت' : 'كتم الصوت'}
                      style={{ ...iconBtn, minWidth: 40, minHeight: 40 }}
                    >
                      {volume === 0
                        ? <VolumeX size={16} aria-hidden />
                        : <Volume2 size={16} aria-hidden />
                      }
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={volume}
                      aria-label="مستوى الصوت"
                      onChange={(e) => changeVolume(parseFloat(e.target.value))}
                      className="audio-range-slider w-20"
                      style={{ direction: 'ltr', accentColor: HQ.MENTOR }}
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Play mode */}
              <div>
                <span className="block mb-1.5" style={{ fontSize: '0.8125rem', fontWeight: 700, color: HQ.MUTED }} id="qa-mode">وضع التشغيل</span>
                <div className="flex gap-2 flex-wrap" role="group" aria-labelledby="qa-mode">
                  {PLAY_MODES.map((m) => {
                    const Icon   = m.icon;
                    const active = playMode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => changePlayMode(m.id)}
                        aria-pressed={active}
                        className="flex items-center gap-1.5 px-3 text-xs font-bold"
                        style={{
                          minHeight: 44, borderRadius: 12, cursor: 'pointer',
                          border: `1px solid ${active ? HQ.MENTOR : HQ.LINE}`,
                          background: active ? HQ.MENTOR : HQ.SURFACE,
                          color: active ? '#fff' : HQ.MUTED,
                        }}
                      >
                        <Icon size={14} aria-hidden />
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 3: Repeat-specific settings */}
              {playMode === 'repeat' && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-xl p-3"
                  style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}` }}
                >
                  <div className="flex flex-wrap gap-4 items-end">
                    {/* Range */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold" style={{ color: HQ.MUTED }}>من آية</span>
                      <input
                        type="number"
                        min={1}
                        max={verseCount}
                        value={repeatRange.from}
                        aria-label="تكرار من آية"
                        onChange={(e) => {
                          const v = Math.max(1, Math.min(+e.target.value, verseCount));
                          changeRepeatRange(v, Math.max(v, repeatRange.to));
                        }}
                        className="text-center text-base focus:border-[#177B58] focus:outline-none"
                        style={{
                          width: 64, minHeight: 44, background: HQ.SURFACE, color: HQ.INK,
                          border: `1px solid ${HQ.LINE}`, borderRadius: 8, padding: '8px',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      />
                      <span className="text-xs font-bold" style={{ color: HQ.MUTED }}>إلى آية</span>
                      <input
                        type="number"
                        min={repeatRange.from}
                        max={verseCount}
                        value={repeatRange.to}
                        aria-label="تكرار إلى آية"
                        onChange={(e) => {
                          const v = Math.max(repeatRange.from, Math.min(+e.target.value, verseCount));
                          changeRepeatRange(repeatRange.from, v);
                        }}
                        className="text-center text-base focus:border-[#177B58] focus:outline-none"
                        style={{
                          width: 64, minHeight: 44, background: HQ.SURFACE, color: HQ.INK,
                          border: `1px solid ${HQ.LINE}`, borderRadius: 8, padding: '8px',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      />
                    </div>

                    {/* Repeat count */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold" style={{ color: HQ.MUTED }}>عدد التكرار</span>
                      <div className="flex items-center rounded-lg overflow-hidden" style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}` }}>
                        <button
                          type="button"
                          onClick={() => changeRepeatCount(Math.max(1, repeatCount - 1))}
                          aria-label="إنقاص التكرار"
                          style={{ ...iconBtn, minWidth: 40, minHeight: 40, borderRadius: 0 }}
                        >
                          <Minus size={14} aria-hidden />
                        </button>
                        <span className="px-3 text-sm font-bold" style={{ color: HQ.INK, minWidth: 32, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                          {repeatCount}
                        </span>
                        <button
                          type="button"
                          onClick={() => changeRepeatCount(Math.min(50, repeatCount + 1))}
                          aria-label="زيادة التكرار"
                          style={{ ...iconBtn, minWidth: 40, minHeight: 40, borderRadius: 0 }}
                        >
                          <Plus size={14} aria-hidden />
                        </button>
                      </div>
                    </div>

                    {/* Current repeat indicator */}
                    {currentRepeat > 0 && (
                      <span className="text-xs font-bold" style={{
                        background: '#E2EFE7', color: '#0F5940', borderRadius: 8, padding: '4px 12px',
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        التكرار {currentRepeat + 1} من {repeatCount}
                      </span>
                    )}
                  </div>

                  {/* Quick action: repeat current verse */}
                  {isActive && (
                    <button
                      type="button"
                      onClick={() => {
                        changeRepeatRange(currentVerseNumber, currentVerseNumber);
                        playAll(currentVerseNumber);
                      }}
                      className="mt-2 text-xs font-bold flex items-center gap-1"
                      style={{ minHeight: 44, background: 'none', border: 'none', cursor: 'pointer', color: HQ.MENTOR }}
                    >
                      <Repeat size={13} aria-hidden />
                      كرّر الآية الحالية ({currentVerseNumber}) {repeatCount} مرات
                    </button>
                  )}
                </motion.div>
              )}

              {/* Listen-repeat description */}
              {playMode === 'listen-repeat' && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-xl p-3 flex items-center gap-2"
                  style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}` }}
                >
                  <Mic size={15} color={HQ.MENTOR} aria-hidden className="flex-none" />
                  <p className="text-xs font-medium" style={{ color: HQ.INK, margin: 0 }}>
                    سيتم تشغيل كل آية ثم التوقف تلقائياً لتردد خلف القارئ.
                    اضغط "التالي" للانتقال للآية التالية.
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
