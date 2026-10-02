import { useMemo } from 'react';
import { ChevronRight, ChevronLeft, MoreHorizontal } from 'lucide-react';
import '../../components/halaqa/halaqa.css';
import { HQ } from '../../components/halaqa/primitives';

export default function Pagination({
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  totalItems,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  showRange = true,
  showPageSize = false,
  itemName = 'عنصر',
  className = '',
}) {
  // Generate page numbers with smart ellipsis
  const pageNumbers = useMemo(() => {
    if (totalPages <= 1) return [1];
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }

    if (currentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  }, [currentPage, totalPages]);

  // If no pages at all or only 1 empty page without page-size option, don't show
  if (totalPages <= 1 && (!totalItems || totalItems === 0)) {
    return null;
  }

  // Calculate item range e.g. 1 - 10 of 45
  const startItem = totalItems ? Math.min((currentPage - 1) * (pageSize || 10) + 1, totalItems) : null;
  const endItem = totalItems ? Math.min(currentPage * (pageSize || 10), totalItems) : null;

  const navBtn = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '8px 12px', borderRadius: 12, border: `1px solid ${HQ.LINE}`,
    background: HQ.SURFACE, color: HQ.INK,
    fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer', minHeight: 44,
  };

  return (
    <div
      className={`halaqa flex flex-col sm:flex-row items-center justify-between gap-3 py-3 px-2 text-sm select-none ${className}`}
      dir="rtl" style={{ color: HQ.MUTED }}
    >
      {/* Range and count info */}
      <div className="flex items-center gap-3 text-xs sm:text-sm order-2 sm:order-1" style={{ color: HQ.MUTED }}>
        {showRange && totalItems !== undefined && totalItems > 0 && (
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            عرض <strong style={{ color: HQ.INK }}>{startItem}</strong> -{' '}
            <strong style={{ color: HQ.INK }}>{endItem}</strong> من أصل{' '}
            <strong style={{ color: HQ.INK }}>{totalItems}</strong> {itemName}
          </span>
        )}

        {showPageSize && onPageSizeChange && (
          <div className="flex items-center gap-1.5 mr-2">
            <span className="text-xs" style={{ color: HQ.MUTED }}>لكل صفحة:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange?.(1);
              }}
              aria-label="عدد العناصر في الصفحة"
              className="text-xs"
              style={{
                background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, color: HQ.INK,
                borderRadius: 8, padding: '6px 8px', minHeight: 44, cursor: 'pointer',
              }}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Page controls (only if totalPages > 1) */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1 order-1 sm:order-2">
          {/* Previous button (in RTL, Right arrow goes previous) */}
          <button
            type="button"
            onClick={() => onPageChange?.(currentPage - 1)}
            disabled={currentPage <= 1}
            style={{ ...navBtn, opacity: currentPage <= 1 ? 0.4 : 1 }}
            aria-label="الصفحة السابقة"
          >
            <ChevronRight size={15} aria-hidden />
            <span className="hidden sm:inline">السابق</span>
          </button>

          {/* Page numbers */}
          <div className="flex items-center gap-1 mx-1">
            {pageNumbers.map((p, idx) => {
              if (p === '...') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="w-7 sm:w-8 h-7 sm:h-8 flex items-center justify-center"
                    style={{ color: HQ.MUTED }}
                    aria-hidden
                  >
                    <MoreHorizontal size={15} />
                  </span>
                );
              }

              const isActive = p === currentPage;
              return (
                <button
                  key={`page-${p}`}
                  type="button"
                  onClick={() => onPageChange?.(p)}
                  className="w-11 h-11 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center"
                  style={{
                    minWidth: 44, minHeight: 44,
                    background: isActive ? HQ.MENTOR : HQ.SURFACE,
                    color: isActive ? '#fff' : HQ.INK,
                    border: isActive ? 'none' : `1px solid ${HQ.LINE}`,
                    cursor: 'pointer', fontVariantNumeric: 'tabular-nums',
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={`الصفحة ${p}`}
                >
                  {p}
                </button>
              );
            })}
          </div>

          {/* Next button (in RTL, Left arrow goes next) */}
          <button
            type="button"
            onClick={() => onPageChange?.(currentPage + 1)}
            disabled={currentPage >= totalPages}
            style={{ ...navBtn, opacity: currentPage >= totalPages ? 0.4 : 1 }}
            aria-label="الصفحة التالية"
          >
            <span className="hidden sm:inline">التالي</span>
            <ChevronLeft size={15} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
