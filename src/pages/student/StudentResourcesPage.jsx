import { useState, useEffect } from 'react';
import { FolderOpen, FileText, Video, Image, Music, Download, Eye } from 'lucide-react';
import PageLayout from '../../components/shared/PageLayout';
import useAuthStore from '../../store/authStore';
import useResourceStore from '../../store/resourceStore';
import { timeAgoAr, formatFileSize } from '../../utils/helpers';
import InteractivePdfViewer from '../../components/shared/InteractivePdfViewer';
import Pagination from '../../components/shared/Pagination';
import usePagination from '../../hooks/usePagination';
import '../../components/halaqa/halaqa.css';
import { HQ } from '../../components/halaqa/primitives';

/* المكتبة — find the file fast. Same fetch/filter/download/viewer logic.
   Categories without emoji, resources as quiet rows. */

const CATEGORIES = {
  tajweed: 'أحكام التجويد',
  memorization: 'خطط الحفظ',
  summary: 'ملخصات',
  exam_prep: 'تحضير امتحانات',
  other: 'أخرى',
};

const FILE_TONE = {
  pdf: { icon: FileText, color: '#C2410C' },
  video: { icon: Video, color: '#3B5BFD' },
  audio: { icon: Music, color: '#4A3F6B' },
  image: { icon: Image, color: '#177B58' },
  other: { icon: FileText, color: '#756E85' },
};

export default function StudentResourcesPage() {
  const { user } = useAuthStore();
  const { resources, isLoading, fetchGeneralResources, fetchGroupResources, trackDownload } = useResourceStore();
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [activePdf, setActivePdf] = useState(null);
  const [accessDenied, setAccessDenied] = useState('');

  const groupId = user?.group?._id || user?.group;
  const pagination = usePagination(resources, 6);

  useEffect(() => {
    setAccessDenied('');
    if (groupId) {
      fetchGroupResources(groupId, { category: categoryFilter !== 'all' ? categoryFilter : undefined });
    } else {
      // المكتبة العامة: للمحدد مستواهم والمسددين
      fetchGeneralResources({ category: categoryFilter !== 'all' ? categoryFilter : undefined })
        .catch(err => setAccessDenied(err?.response?.data?.message || 'تعذر تحميل المكتبة'));
    }
  }, [groupId, categoryFilter]);

  const handleDownload = (resource) => {
    trackDownload(resource._id);
    window.open(resource.fileUrl, '_blank');
  };

  const openPdf = (resource) => {
    trackDownload(resource._id);
    setActivePdf({ fileUrl: resource.fileUrl, title: resource.title, id: resource._id });
  };

  return (
    <PageLayout>
      <div className="halaqa" style={{ maxWidth: 760, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 900, color: HQ.INK }}>المكتبة</h1>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: HQ.MUTED }}>ملفات ومراجع من معلمك للحفظ والتجويد</p>

        {/* Category filter — text only */}
        <div role="tablist" aria-label="تصنيفات المصادر" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {[{ key: 'all', label: 'الكل' }, ...Object.entries(CATEGORIES).map(([key, label]) => ({ key, label }))].map(c => (
            <button key={c.key} role="tab" aria-selected={categoryFilter === c.key}
              onClick={() => setCategoryFilter(c.key)}
              style={{
                border: `1px solid ${categoryFilter === c.key ? HQ.MENTOR : HQ.LINE}`,
                cursor: 'pointer', minHeight: 44, padding: '0 18px', borderRadius: 12,
                fontSize: 14, fontWeight: 800,
                background: categoryFilter === c.key ? HQ.MENTOR : HQ.SURFACE,
                color: categoryFilter === c.key ? '#fff' : HQ.MUTED,
              }}>
              {c.label}
            </button>
          ))}
        </div>

        {!groupId && accessDenied ? (
          <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 48, textAlign: 'center' }}>
            <FolderOpen size={40} color={HQ.LINE} style={{ margin: '0 auto 12px' }} />
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: HQ.INK }}>المكتبة غير متاحة حالياً</p>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: HQ.MUTED }}>{accessDenied}</p>
          </div>
        ) : isLoading ? (
          <div aria-label="جارٍ تحميل المصادر">
            <div className="hq-skeleton" style={{ height: 72, width: '100%', marginBottom: 10 }} />
            <div className="hq-skeleton" style={{ height: 72, width: '100%', marginBottom: 10 }} />
            <div className="hq-skeleton" style={{ height: 72, width: '100%' }} />
          </div>
        ) : resources.length === 0 ? (
          <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 48, textAlign: 'center' }}>
            <FolderOpen size={40} color={HQ.LINE} style={{ margin: '0 auto 12px' }} />
            <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: HQ.INK }}>
              لا مصادر{categoryFilter !== 'all' ? ' في هذا التصنيف' : ' بعد'}
            </p>
            <p style={{ margin: 0, fontSize: 14, color: HQ.MUTED }}>
              {categoryFilter !== 'all' ? 'جرّب تصنيفًا آخر أو عرض الكل.' : 'سيضيف المعلم الملفات هنا قريبًا.'}
            </p>
          </div>
        ) : (
          <>
            <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {pagination.paginatedItems.map(resource => {
                const fi = FILE_TONE[resource.fileType] || FILE_TONE.other;
                const FI = fi.icon;
                const isPdf = resource.fileType === 'pdf';
                return (
                  <li key={resource._id} style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, marginBottom: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span aria-hidden style={{ width: 44, height: 44, borderRadius: 12, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                      <FI size={20} color={fi.color} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ display: 'block', fontSize: 15, color: HQ.INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {resource.title}
                      </strong>
                      <span style={{ display: 'block', fontSize: 13, color: HQ.MUTED, marginTop: 2 }}>
                        {CATEGORIES[resource.category] || CATEGORIES.other}
                        {resource.uploadedBy?.firstName ? ` · من ${resource.uploadedBy.firstName}` : ''}
                        {resource.fileSize ? ` · ${formatFileSize(resource.fileSize)}` : ''}
                        {resource.createdAt ? ` · ${timeAgoAr(resource.createdAt)}` : ''}
                      </span>
                      {resource.description && (
                        <span style={{ display: 'block', fontSize: 13, color: HQ.MUTED, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {resource.description}
                        </span>
                      )}
                    </span>
                    <span style={{ display: 'flex', gap: 8, flex: 'none' }}>
                      {isPdf && (
                        <button type="button" onClick={() => openPdf(resource)} className="hq-action" aria-label={`عرض ${resource.title}`}
                          style={{ background: HQ.MENTOR, color: '#fff', padding: '0 18px', fontSize: 14 }}>
                          <Eye size={16} /> عرض
                        </button>
                      )}
                      <button type="button" onClick={() => handleDownload(resource)}
                        className="hq-action" aria-label={`تحميل ${resource.title}`}
                        style={{ background: isPdf ? HQ.PAPER : HQ.MENTOR, color: isPdf ? HQ.INK : '#fff', border: isPdf ? `1px solid ${HQ.LINE}` : 'none', padding: '0 18px', fontSize: 14 }}>
                        <Download size={16} /> {!isPdf && 'تحميل'}
                      </button>
                    </span>
                  </li>
                );
              })}
            </ol>
            <Pagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              pageSize={pagination.pageSize}
              onPageChange={pagination.setCurrentPage}
              onPageSizeChange={pagination.setPageSize}
              showPageSize={true}
              pageSizeOptions={[6, 12, 24]}
              itemName="ملف تعليمي"
              className="mt-6"
            />
          </>
        )}

        {activePdf && (
          <InteractivePdfViewer
            pdfUrl={activePdf.fileUrl}
            title={activePdf.title}
            resourceId={activePdf.id}
            onClose={() => setActivePdf(null)}
          />
        )}
      </div>
    </PageLayout>
  );
}
