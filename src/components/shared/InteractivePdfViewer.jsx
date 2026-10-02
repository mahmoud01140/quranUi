import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, ChevronLeft, ChevronRight, Plus, Minus, Download, X,
  Highlighter, MessageSquare, Trash2, ZoomIn, ZoomOut, Check,
  BookOpen, Edit3, List, Sparkles, RotateCcw, AlertCircle, Loader2, Maximize
} from 'lucide-react';

export default function InteractivePdfViewer({ pdfUrl, title, resourceId, onClose }) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [isPdfLoading, setIsPdfLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tools: 'select' | 'highlight' | 'comment'
  const [activeTool, setActiveTool] = useState('select');
  const [selectedColor, setSelectedColor] = useState('yellow'); // yellow, green, blue

  // Annotations
  const [annotations, setAnnotations] = useState([]);
  const [pendingComment, setPendingComment] = useState(null); // { x, y } coordinates in percent
  const [commentText, setCommentText] = useState('');
  const [activeCommentId, setActiveCommentId] = useState(null); // Currently open comment tooltip

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [pdfTextContent, setPdfTextContent] = useState([]); // Array of { pageNum, text }
  const [isIndexing, setIsIndexing] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('search'); // 'search' | 'comments'

  // Refs
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const overlayRef = useRef(null);
  const renderTaskRef = useRef(null);

  // Drawing state for highlight
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentRect, setCurrentRect] = useState(null); // { x, y, width, height } relative to overlay

  // Colors mapping
  const colors = {
    yellow: { rgba: 'rgba(253, 224, 71, 0.4)', bg: 'bg-yellow-300', border: 'border-yellow-500', hex: '#fde047' },
    green: { rgba: 'rgba(74, 222, 128, 0.4)', bg: 'bg-green-400', border: 'border-green-600', hex: '#4ade80' },
    blue: { rgba: 'rgba(96, 165, 250, 0.4)', bg: 'bg-blue-400', border: 'border-blue-600', hex: '#60a5fa' },
  };

  // 1. Load pdf.js dynamically from CDN
  useEffect(() => {
    let isMounted = true;
    setIsPdfLoading(true);
    setError(null);

    const initPdf = async () => {
      try {
        if (!window.pdfjsLib) {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          script.async = true;
          
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = () => reject(new Error('فشل تحميل مكتبة PDF.js'));
            document.head.appendChild(script);
          });
        }

        const pdfjsLib = window.pdfjsLib;
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        if (isMounted) {
          const loadingTask = pdfjsLib.getDocument(pdfUrl);
          const pdf = await loadingTask.promise;
          setPdfDoc(pdf);
          setNumPages(pdf.numPages);
          setIsPdfLoading(false);
          
          // Index text content for search in background
          extractTextContent(pdf);
        }
      } catch (err) {
        console.error('PDF error:', err);
        if (isMounted) {
          setError('حدث خطأ أثناء تحميل ملف الـ PDF. يرجى التحقق من الرابط وإعادة المحاولة.');
          setIsPdfLoading(false);
        }
      }
    };

    initPdf();

    // Load saved annotations
    const saved = localStorage.getItem(`pdf_ann_${resourceId}`);
    if (saved) {
      try {
        setAnnotations(JSON.parse(saved));
      } catch (e) {
        console.error('Error parsing annotations:', e);
      }
    }

    return () => {
      isMounted = false;
    };
  }, [pdfUrl, resourceId]);

  // Extract text from all pages for search
  const extractTextContent = async (pdf) => {
    setIsIndexing(true);
    const pagesText = [];
    try {
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        pagesText.push({ pageNum: i, text: pageText });
      }
      setPdfTextContent(pagesText);
    } catch (e) {
      console.error('Failed to extract text:', e);
    } finally {
      setIsIndexing(false);
    }
  };

  // 2. Render Page on Canvas
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;

    try {
      // Cancel previous render task if active
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      const dpr = window.devicePixelRatio || 1;
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      context.scale(dpr, dpr);

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;
      await renderTask.promise;
      renderTaskRef.current = null;
    } catch (err) {
      if (err.name !== 'RenderingCancelledException') {
        console.error('Render error:', err);
      }
    }
  }, [pdfDoc, pageNum, scale]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  // Adjust zoom to fit width of container automatically on mount or window resize
  const fitWidth = useCallback(async () => {
    if (!pdfDoc || !containerRef.current) return;
    try {
      const page = await pdfDoc.getPage(1);
      const viewport = page.getViewport({ scale: 1.0 });
      const containerWidth = containerRef.current.clientWidth - 40; // padding
      const newScale = containerWidth / viewport.width;
      // Cap scale between 0.5 and 2.0
      setScale(Math.max(0.5, Math.min(2.0, newScale)));
    } catch (e) {
      console.error(e);
    }
  }, [pdfDoc]);

  useEffect(() => {
    if (pdfDoc) {
      fitWidth();
    }
  }, [pdfDoc, fitWidth]);

  // Handle window resizing
  useEffect(() => {
    const handleResize = () => {
      fitWidth();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [fitWidth]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') {
        // In Arabic layout, Right Arrow goes to Previous Page
        setPageNum(p => Math.max(1, p - 1));
      } else if (e.key === 'ArrowLeft') {
        setPageNum(p => Math.min(numPages, p + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [numPages]);

  // Search memoized logic
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || pdfTextContent.length === 0) return [];
    const results = [];
    const queryLower = searchQuery.toLowerCase();
    
    pdfTextContent.forEach(({ pageNum, text }) => {
      let index = text.toLowerCase().indexOf(queryLower);
      while (index !== -1) {
        const start = Math.max(0, index - 25);
        const end = Math.min(text.length, index + queryLower.length + 25);
        let snippet = text.substring(start, end);
        if (start > 0) snippet = '...' + snippet;
        if (end < text.length) snippet = snippet + '...';

        results.push({
          pageNum,
          snippet,
          index
        });
        index = text.toLowerCase().indexOf(queryLower, index + 1);
      }
    });
    return results;
  }, [searchQuery, pdfTextContent]);

  // Save annotations to localStorage helper
  const saveAnnotations = (newAnnotations) => {
    setAnnotations(newAnnotations);
    localStorage.setItem(`pdf_ann_${resourceId}`, JSON.stringify(newAnnotations));
  };

  // Delete an annotation
  const deleteAnnotation = (id) => {
    const filtered = annotations.filter(ann => ann.id !== id);
    saveAnnotations(filtered);
    if (activeCommentId === id) setActiveCommentId(null);
  };

  // Add text comment
  const handleAddComment = () => {
    if (!commentText.trim() || !pendingComment) return;
    const newComment = {
      id: Date.now().toString(),
      type: 'comment',
      page: pageNum,
      x: pendingComment.x,
      y: pendingComment.y,
      text: commentText,
      createdAt: Date.now()
    };
    saveAnnotations([...annotations, newComment]);
    setPendingComment(null);
    setCommentText('');
  };

  // Handle click on PDF overlay
  const handleOverlayClick = (e) => {
    if (activeTool !== 'comment' || isDrawing) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingComment({ x, y });
  };

  // Drawing highlight rectangles
  const handleMouseDown = (e) => {
    if (activeTool !== 'highlight') return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setStartPos({ x, y });
    setIsDrawing(true);
    setCurrentRect({ x, y, width: 0, height: 0 });
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || activeTool !== 'highlight') return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCurrentRect({
      x: Math.min(startPos.x, x),
      y: Math.min(startPos.y, y),
      width: Math.abs(startPos.x - x),
      height: Math.abs(startPos.y - y)
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing || activeTool !== 'highlight') return;
    setIsDrawing(false);
    if (currentRect && currentRect.width > 5 && currentRect.height > 5) {
      const rect = overlayRef.current.getBoundingClientRect();
      const newHighlight = {
        id: Date.now().toString(),
        type: 'highlight',
        page: pageNum,
        x: (currentRect.x / rect.width) * 100,
        y: (currentRect.y / rect.height) * 100,
        width: (currentRect.width / rect.width) * 100,
        height: (currentRect.height / rect.height) * 100,
        color: selectedColor
      };
      saveAnnotations([...annotations, newHighlight]);
    }
    setCurrentRect(null);
  };

  // Filter current page annotations
  const pageAnnotations = useMemo(() => {
    return annotations.filter(ann => ann.page === pageNum);
  }, [annotations, pageNum]);

  // Sidebar list of comments
  const commentsList = useMemo(() => {
    return annotations.filter(ann => ann.type === 'comment');
  }, [annotations]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="halaqa fixed inset-0 z-50 flex flex-col overflow-hidden text-right"
      style={{ background: '#FBF7EE' }}
      dir="rtl"
    >
      {/* Upper toolbar */}
      <div className="flex flex-nowrap items-center justify-between gap-2 sm:gap-4 p-2.5 sm:p-4 overflow-x-auto no-scrollbar"
        style={{ background: '#FFFFFF', borderBottom: '1px solid #E8E2D4' }}>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق عارض المستند"
            className="transition-colors"
            style={{ minWidth: 44, minHeight: 44, borderRadius: 12, border: 'none', background: 'transparent', color: '#756E85', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 6 }}
            title="إغلاق"
          >
            <X className="w-5 h-5" aria-hidden />
          </button>
          <div className="min-w-0">
            <h2 className="font-bold text-xs sm:text-base md:text-lg truncate max-w-[120px] sm:max-w-xs md:max-w-md" style={{ color: '#2A2438', margin: 0 }}>{title}</h2>
            <p className="sm:text-xs" style={{ fontSize: '0.8125rem', color: '#756E85', margin: 0 }}>عارض تفاعلي مدمج</p>
          </div>
        </div>

        {/* Middle controls: Zoom & Navigation */}
        {!isPdfLoading && !error && (
          <div className="flex items-center gap-1.5 sm:gap-3 mx-1 sm:mx-0 flex-shrink-0">
            {/* Navigation */}
            <div className="flex items-center rounded-xl p-0.5 sm:p-1"
              style={{ background: '#FBF7EE', border: '1px solid #E8E2D4' }}>
              <button
                type="button"
                disabled={pageNum <= 1}
                onClick={() => setPageNum(p => Math.max(1, p - 1))}
                aria-label="الصفحة السابقة"
                className="rounded-lg disabled:opacity-30 transition-colors"
                style={{ minWidth: 44, minHeight: 44, border: 'none', background: 'transparent', color: '#2A2438', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}
                title="الصفحة السابقة"
              >
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden />
              </button>

              <span className="sm:text-xs font-semibold px-1.5 sm:px-2 flex items-center gap-1 select-none"
                style={{ fontSize: '0.8125rem', color: '#2A2438', fontVariantNumeric: 'tabular-nums' }}>
                <span>{pageNum}</span>
                <span style={{ color: '#756E85' }}>/</span>
                <span>{numPages}</span>
              </span>

              <button
                type="button"
                disabled={pageNum >= numPages}
                onClick={() => setPageNum(p => Math.min(numPages, p + 1))}
                aria-label="الصفحة التالية"
                className="rounded-lg disabled:opacity-30 transition-colors"
                style={{ minWidth: 44, minHeight: 44, border: 'none', background: 'transparent', color: '#2A2438', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}
                title="الصفحة التالية"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden />
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center rounded-xl p-0.5 sm:p-1"
              style={{ background: '#FBF7EE', border: '1px solid #E8E2D4' }}>
              <button
                type="button"
                disabled={scale <= 0.5}
                onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
                aria-label="تصغير"
                className="rounded-lg disabled:opacity-30 transition-colors"
                style={{ minWidth: 44, minHeight: 44, border: 'none', background: 'transparent', color: '#2A2438', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}
                title="تصغير"
              >
                <ZoomOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden />
              </button>
              <span className="sm:text-xs font-semibold px-1 sm:px-2 text-center select-none"
                style={{ fontSize: '0.8125rem', color: '#2A2438', minWidth: 48, fontVariantNumeric: 'tabular-nums' }}>
                {Math.round(scale * 100)}%
              </span>
              <button
                type="button"
                disabled={scale >= 2.5}
                onClick={() => setScale(s => Math.min(2.5, s + 0.25))}
                aria-label="تكبير"
                className="rounded-lg disabled:opacity-30 transition-colors"
                style={{ minWidth: 44, minHeight: 44, border: 'none', background: 'transparent', color: '#2A2438', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}
                title="تكبير"
              >
                <ZoomIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={fitWidth}
                aria-label="ملائمة العرض"
                className="rounded-lg transition-colors"
                style={{ minWidth: 40, minHeight: 40, border: 'none', background: 'transparent', color: '#2A2438', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 4, marginRight: 2 }}
                title="ملائمة العرض"
              >
                <Maximize className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden />
              </button>
            </div>
          </div>
        )}

        {/* Right side: Tools & download */}
        {!isPdfLoading && !error && (
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {/* Tool Selection */}
            <div className="flex rounded-xl p-0.5 sm:p-1 gap-0.5" role="group" aria-label="أدوات المستند"
              style={{ background: '#FBF7EE', border: '1px solid #E8E2D4' }}>
              <button
                type="button"
                onClick={() => setActiveTool('select')}
                aria-pressed={activeTool === 'select'}
                className="px-2 sm:px-3 rounded-lg text-xs font-semibold flex items-center gap-1"
                style={{
                  minHeight: 44, border: 'none', cursor: 'pointer',
                  background: activeTool === 'select' ? '#177B58' : 'transparent',
                  color: activeTool === 'select' ? '#fff' : '#756E85',
                }}
                title="أداة التحديد والتحريك"
              >
                <BookOpen className="w-3.5 h-3.5" aria-hidden />
                <span className="hidden md:inline">قراءة</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('highlight')}
                aria-pressed={activeTool === 'highlight'}
                className="px-2 sm:px-3 rounded-lg text-xs font-semibold flex items-center gap-1"
                style={{
                  minHeight: 44, border: 'none', cursor: 'pointer',
                  background: activeTool === 'highlight' ? '#177B58' : 'transparent',
                  color: activeTool === 'highlight' ? '#fff' : '#756E85',
                }}
                title="تظليل النصوص والفقرات"
              >
                <Highlighter className="w-3.5 h-3.5" aria-hidden />
                <span className="hidden md:inline">تظليل</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('comment')}
                aria-pressed={activeTool === 'comment'}
                className="px-2 sm:px-3 rounded-lg text-xs font-semibold flex items-center gap-1"
                style={{
                  minHeight: 44, border: 'none', cursor: 'pointer',
                  background: activeTool === 'comment' ? '#177B58' : 'transparent',
                  color: activeTool === 'comment' ? '#fff' : '#756E85',
                }}
                title="إضافة ملاحظة عند النقر"
              >
                <MessageSquare className="w-3.5 h-3.5" aria-hidden />
                <span className="hidden md:inline">ملاحظة</span>
              </button>
            </div>

            {/* Colors selection for highlighter */}
            {activeTool === 'highlight' && (
              <div className="flex items-center rounded-xl p-1 sm:p-1.5 gap-1 sm:gap-1.5"
                role="group" aria-label="لون التظليل"
                style={{ background: '#FBF7EE', border: '1px solid #E8E2D4' }}>
                {Object.entries(colors).map(([name, config]) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setSelectedColor(name)}
                    aria-label={`لون التظليل ${name}`}
                    aria-pressed={selectedColor === name}
                    className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full ${config.bg}`}
                    style={{
                      minWidth: 32, minHeight: 32, border: `2px solid ${selectedColor === name ? '#177B58' : 'transparent'}`,
                      cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  />
                ))}
              </div>
            )}

            {/* Sidebar toggle */}
            <button
              type="button"
              onClick={() => setShowSidebar(!showSidebar)}
              aria-expanded={showSidebar}
              aria-label="البحث والتعليقات"
              className="transition-all"
              style={{
                minWidth: 44, minHeight: 44, borderRadius: 12, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: showSidebar ? '#177B58' : '#FFFFFF',
                color: showSidebar ? '#fff' : '#756E85',
                border: `1px solid ${showSidebar ? '#177B58' : '#E8E2D4'}`,
              }}
              title="البحث والتعليقات"
            >
              <Search className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden />
            </button>

            {/* Download option */}
            <a
              href={pdfUrl}
              download={`${title}.pdf`}
              target="_blank"
              rel="noreferrer"
              aria-label="تحميل الملف"
              className="transition-colors"
              style={{
                minWidth: 44, minHeight: 44, borderRadius: 12,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: '#FFFFFF', color: '#756E85', border: '1px solid #E8E2D4',
              }}
              title="تحميل الملف"
            >
              <Download className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden />
            </a>
          </div>
        )}
      </div>

      {/* Main Workspace split */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar for Search and comments */}
        <AnimatePresence>
          {showSidebar && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full absolute sm:static inset-y-0 right-0 z-20 w-full sm:w-80 flex flex-col flex-shrink-0"
              style={{ background: '#FFFFFF', borderLeft: '1px solid #E8E2D4' }}
            >
              {/* Tab Selector */}
              <div className="flex p-2 gap-2" style={{ borderBottom: '1px solid #E8E2D4' }}>
                <button
                  type="button"
                  onClick={() => setSidebarTab('search')}
                  aria-selected={sidebarTab === 'search'}
                  className="flex-1 py-2 px-3 text-xs font-bold flex items-center justify-center gap-1.5"
                  style={{
                    minHeight: 44, background: 'none', border: 'none', cursor: 'pointer',
                    borderBottom: `2px solid ${sidebarTab === 'search' ? '#177B58' : 'transparent'}`,
                    color: sidebarTab === 'search' ? '#177B58' : '#756E85',
                  }}
                >
                  <Search className="w-4 h-4" aria-hidden />
                  البحث في المستند
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarTab('comments')}
                  aria-selected={sidebarTab === 'comments'}
                  className="flex-1 py-2 px-3 text-xs font-bold flex items-center justify-center gap-1.5"
                  style={{
                    minHeight: 44, background: 'none', border: 'none', cursor: 'pointer',
                    borderBottom: `2px solid ${sidebarTab === 'comments' ? '#177B58' : 'transparent'}`,
                    color: sidebarTab === 'comments' ? '#177B58' : '#756E85',
                  }}
                >
                  <MessageSquare className="w-4 h-4" aria-hidden />
                  ملاحظاتي ({commentsList.length})
                </button>
              </div>

              {/* Tab contents */}
              <div className="flex-1 overflow-y-auto p-4">
                {sidebarTab === 'search' ? (
                  <div className="space-y-4">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="ابحث عن كلمة أو جملة..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        aria-label="بحث في المستند"
                        className="w-full text-sm focus:border-[#177B58] focus:outline-none"
                        style={{
                          minHeight: 44, background: '#FFFFFF', color: '#2A2438',
                          border: '1px solid #E8E2D4', borderRadius: 12, padding: '10px 16px 10px 40px',
                        }}
                      />
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#756E85' }} aria-hidden />
                    </div>

                    {isIndexing && (
                      <div className="flex items-center gap-2 text-xs p-3 rounded-lg"
                        style={{ color: '#756E85', background: '#FBF7EE', border: '1px solid #E8E2D4' }}>
                        <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#177B58' }} aria-hidden />
                        <span>جاري فهرسة نصوص الملف للبحث...</span>
                      </div>
                    )}

                    {!isIndexing && searchQuery.trim() && (
                      <div className="text-xs mb-2" style={{ color: '#756E85', fontVariantNumeric: 'tabular-nums' }}>
                        تم العثور على {searchResults.length} نتيجة:
                      </div>
                    )}

                    <div className="space-y-2">
                      {searchQuery.trim() && searchResults.map((res, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setPageNum(res.pageNum)}
                          className="w-full text-right p-3 rounded-xl text-sm block"
                          style={{
                            background: pageNum === res.pageNum ? '#E2EFE7' : '#FFFFFF',
                            border: `1px solid ${pageNum === res.pageNum ? '#177B58' : '#E8E2D4'}`,
                            cursor: 'pointer',
                          }}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-xs px-2 py-0.5"
                              style={{ color: '#0F5940', background: '#E2EFE7', borderRadius: 8, fontVariantNumeric: 'tabular-nums' }}>
                              صفحة {res.pageNum}
                            </span>
                            <span style={{ fontSize: '0.8125rem', color: '#756E85', fontVariantNumeric: 'tabular-nums' }}>نتيجة {i + 1}</span>
                          </div>
                          <p className="text-xs leading-relaxed italic" dir="auto" style={{ color: '#2A2438', margin: 0 }}>
                            {res.snippet}
                          </p>
                        </button>
                      ))}

                      {searchQuery.trim() && searchResults.length === 0 && (
                        <div className="text-center py-6 text-xs" style={{ color: '#756E85' }}>
                          <AlertCircle className="w-8 h-8 mx-auto mb-2" style={{ color: '#E8E2D4' }} aria-hidden />
                          لم نعثر على أي تطابق للبحث.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {commentsList.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-xl p-3"
                        style={{ background: '#FFFFFF', border: '1px solid #E8E2D4' }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <button
                            type="button"
                            onClick={() => setPageNum(c.page)}
                            className="font-semibold text-xs px-2.5 py-0.5"
                            style={{
                              minHeight: 36, borderRadius: 8, cursor: 'pointer',
                              background: '#E2EFE7', color: '#0F5940', border: 'none', fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            صفحة {c.page}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteAnnotation(c.id)}
                            aria-label="حذف الملاحظة"
                            className="transition-colors"
                            style={{
                              minWidth: 44, minHeight: 44, borderRadius: 8, border: 'none',
                              background: 'none', color: '#C2410C', cursor: 'pointer',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            }}
                            title="حذف الملاحظة"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden />
                          </button>
                        </div>
                        <p className="text-xs leading-relaxed font-medium break-words" style={{ color: '#2A2438', margin: 0 }}>
                          {c.text}
                        </p>
                        <span className="block mt-1" style={{ fontSize: '0.8125rem', color: '#756E85', fontVariantNumeric: 'tabular-nums' }}>
                          {new Date(c.createdAt).toLocaleDateString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    ))}

                    {commentsList.length === 0 && (
                      <div className="text-center py-12 text-xs" style={{ color: '#756E85' }}>
                        <MessageSquare className="w-10 h-10 mx-auto mb-2" style={{ color: '#E8E2D4' }} aria-hidden />
                        لا توجد أي ملاحظات مكتوبة بعد.
                        <p className="mt-1" style={{ fontSize: '0.8125rem', color: '#756E85', marginBottom: 0 }}>
                          اختر أداة "ملاحظة" ثم انقر في أي مكان على الصفحة لإضافة ملاحظة.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center Viewer Area */}
        <div
          ref={containerRef}
          className="halaqa flex-1 overflow-auto p-4 flex items-start justify-center relative select-none"
          style={{ background: '#FBF7EE' }}
        >
          {isPdfLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ color: '#756E85' }}>
              <Loader2 className="w-10 h-10 animate-spin" style={{ color: '#177B58' }} aria-hidden />
              <p className="text-sm font-semibold animate-pulse" style={{ margin: 0 }}>جاري تحميل المستند وبدء العرض...</p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl text-center max-w-md my-auto" style={{ background: '#FFFFFF', border: '1px solid #E8E2D4' }}>
              <AlertCircle className="w-12 h-12 mx-auto mb-3" style={{ color: '#C2410C' }} aria-hidden />
              <h3 className="font-bold text-base mb-2" style={{ color: '#2A2438', marginTop: 0 }}>فشل تحميل الملف</h3>
              <p className="text-xs leading-relaxed mb-4" style={{ color: '#756E85' }}>{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="font-bold"
                style={{ minHeight: 48, padding: '8px 24px', borderRadius: 12, cursor: 'pointer', background: '#177B58', color: '#fff', border: 'none', fontSize: '0.8125rem' }}
              >
                العودة للمكتبة
              </button>
            </div>
          ) : (
            <div className="relative rounded-lg bg-white my-4 overflow-hidden" style={{ border: '1px solid #E8E2D4' }}>
              {/* PDF Render Canvas */}
              <canvas ref={canvasRef} className="block select-none" />

              {/* Transparent Overlay for Drawing and Interactions */}
              <div
                ref={overlayRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onClick={handleOverlayClick}
                className={`absolute inset-0 z-20 ${
                  activeTool === 'select' ? 'cursor-default' : 'cursor-crosshair'
                }`}
              >
                {/* Render Highlights */}
                {pageAnnotations
                  .filter(ann => ann.type === 'highlight')
                  .map(h => (
                    <div
                      key={h.id}
                      style={{
                        position: 'absolute',
                        left: `${h.x}%`,
                        top: `${h.y}%`,
                        width: `${h.width}%`,
                        height: `${h.height}%`,
                        backgroundColor: colors[h.color]?.rgba || colors.yellow.rgba,
                      }}
                      className="group transition-all"
                    >
                      {/* Delete button — always visible for touch */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteAnnotation(h.id);
                        }}
                        aria-label="حذف التظليل"
                        className="absolute flex items-center justify-center"
                        style={{
                          top: -12, left: -12, width: 28, height: 28, borderRadius: 9999,
                          background: '#C2410C', color: '#fff', border: '2px solid #fff',
                          cursor: 'pointer',
                        }}
                        title="حذف التظليل"
                      >
                        <X className="w-3.5 h-3.5" aria-hidden />
                      </button>
                    </div>
                  ))}

                {/* Render Comments/Notes pins */}
                {pageAnnotations
                  .filter(ann => ann.type === 'comment')
                  .map(c => (
                    <div
                      key={c.id}
                      style={{
                        position: 'absolute',
                        left: `${c.x}%`,
                        top: `${c.y}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                      className="z-30 group"
                    >
                      {/* Note Pin Icon */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveCommentId(activeCommentId === c.id ? null : c.id);
                        }}
                        aria-label={activeCommentId === c.id ? 'إغلاق الملاحظة' : 'فتح الملاحظة'}
                        className="rounded-full flex items-center justify-center"
                        style={{
                          width: 32, height: 32, cursor: 'pointer',
                          background: activeCommentId === c.id ? '#177B58' : '#FFFFFF',
                          color: activeCommentId === c.id ? '#fff' : '#177B58',
                          border: `2px solid #177B58`,
                        }}
                      >
                        <MessageSquare className="w-4 h-4" aria-hidden />
                      </button>

                      {/* Comment Tooltip Popover */}
                      <AnimatePresence>
                        {activeCommentId === c.id && (
                          <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2 }}
                            className="absolute bottom-10 right-1/2 translate-x-1/2 w-64 p-3 rounded-xl z-40 text-right"
                            style={{ background: '#FFFFFF', border: '1px solid #E8E2D4' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-start justify-between pb-1.5 mb-1.5" style={{ borderBottom: '1px solid #E8E2D4' }}>
                              <span style={{ fontSize: '0.8125rem', color: '#756E85', fontVariantNumeric: 'tabular-nums' }}>
                                {new Date(c.createdAt).toLocaleDateString('ar-EG', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              <button
                                type="button"
                                onClick={() => deleteAnnotation(c.id)}
                                aria-label="حذف الملاحظة"
                                className="rounded transition-colors"
                                style={{ minWidth: 36, minHeight: 36, border: 'none', background: 'none', color: '#C2410C', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <Trash2 className="w-3.5 h-3.5" aria-hidden />
                              </button>
                            </div>
                            <p className="text-xs leading-relaxed font-medium break-words" style={{ color: '#2A2438', margin: 0 }}>
                              {c.text}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}

                {/* Drawing Indicator Rectangle */}
                {isDrawing && currentRect && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${currentRect.x}px`,
                      top: `${currentRect.y}px`,
                      width: `${currentRect.width}px`,
                      height: `${currentRect.height}px`,
                      backgroundColor: colors[selectedColor]?.rgba || colors.yellow.rgba,
                      border: `1.5px dashed ${colors[selectedColor]?.hex || colors.yellow.hex}`,
                    }}
                  />
                )}
              </div>

              {/* Pending Comment Placement form */}
              <AnimatePresence>
                {pendingComment && (
                  <div className="absolute inset-0 flex items-center justify-center z-40"
                    style={{ background: 'rgba(42,36,56,0.55)' }}>
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 12 }}
                      transition={{ duration: 0.2 }}
                      className="rounded-2xl p-4 w-80 text-right"
                      style={{ background: '#FFFFFF', border: '1px solid #E8E2D4' }}
                    >
                      <h4 className="font-bold text-sm mb-2 flex items-center gap-1.5" style={{ color: '#2A2438', marginTop: 0 }}>
                        <MessageSquare className="w-4 h-4" style={{ color: '#177B58' }} aria-hidden />
                        إضافة ملاحظة جديدة
                      </h4>
                      <textarea
                        rows="3"
                        placeholder="اكتب ملاحظتك هنا..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        aria-label="نص الملاحظة الجديدة"
                        className="w-full text-xs focus:border-[#177B58] focus:outline-none resize-none mb-3"
                        style={{
                          minHeight: 72, background: '#FFFFFF', color: '#2A2438',
                          border: '1px solid #E8E2D4', borderRadius: 12, padding: 12,
                        }}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleAddComment}
                          className="flex-1 text-xs font-bold flex items-center justify-center gap-1"
                          style={{ minHeight: 48, background: '#177B58', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer' }}
                        >
                          <Check className="w-3.5 h-3.5" aria-hidden />
                          حفظ
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPendingComment(null);
                            setCommentText('');
                          }}
                          className="flex-1 text-xs font-bold"
                          style={{ minHeight: 48, background: '#FBF7EE', color: '#2A2438', border: 'none', borderRadius: 12, cursor: 'pointer' }}
                        >
                          إلغاء
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
