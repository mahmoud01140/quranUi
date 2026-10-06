import api from '../services/api';

/* تقرير الطالب — يُبنى من sections التقرير (attendance, exams, ...).
   كل قسم له Renderer مخصص، وأي قسم مستقبلي يُعرض بجدول عام تلقائياً. */

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const fmtDate = (d) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return '—'; }
};

const ATT_STATUS_AR = { present: 'حاضر', late: 'متأخر', absent: 'غائب', excused: 'معذور', scheduled: 'مجدولة' };
const EXAM_TYPE_AR = { placement: 'تحديد مستوى', oral: 'شفهي', weekly: 'أسبوعي', monthly: 'شهري', final: 'نهائي', lesson: 'درس' };

function renderAttendance(att) {
  if (!att) return '';
  const rows = (att.history || []).map((h, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(h.title)}</td>
      <td>${fmtDate(h.date)}</td>
      <td>${esc(h.teacherName || '—')}</td>
      <td>${ATT_STATUS_AR[h.status] || esc(h.status)}</td>
    </tr>`).join('');
  return `
    <h2>الحضور والغياب</h2>
    <div class="cards">
      <div class="card"><b>${att.rate ?? 0}%</b><span>نسبة الحضور</span></div>
      <div class="card"><b>${att.total ?? 0}</b><span>إجمالي الحصص</span></div>
      <div class="card"><b>${att.present ?? 0}</b><span>حاضر</span></div>
      <div class="card"><b>${att.late ?? 0}</b><span>متأخر</span></div>
      <div class="card"><b>${att.absent ?? 0}</b><span>غائب</span></div>
      <div class="card"><b>${att.excused ?? 0}</b><span>معذور</span></div>
    </div>
    ${rows ? `<table><thead><tr><th>#</th><th>الحصة</th><th>التاريخ</th><th>المعلم</th><th>الحالة</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<p class="muted">لا توجد سجلات حضور بعد.</p>'}`;
}

function renderExams(ex) {
  if (!ex) return '';
  const rows = (ex.results || []).map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(r.examTitle)}</td>
      <td>${EXAM_TYPE_AR[r.examType] || esc(r.examType || '—')}</td>
      <td>${r.percentage ?? 0}%</td>
      <td>${r.isPassed ? 'ناجح' : 'راسب/غير مكتمل'}</td>
      <td>${fmtDate(r.date)}</td>
    </tr>`).join('');
  return `
    <h2>نتائج الامتحانات</h2>
    <div class="cards">
      <div class="card"><b>${ex.total ?? 0}</b><span>عدد الامتحانات</span></div>
      <div class="card"><b>${ex.passed ?? 0}</b><span>ناجح</span></div>
      <div class="card"><b>${ex.average === null || ex.average === undefined ? '—' : `${ex.average}%`}</b><span>المتوسط</span></div>
    </div>
    ${rows ? `<table><thead><tr><th>#</th><th>الامتحان</th><th>النوع</th><th>الدرجة</th><th>النتيجة</th><th>التاريخ</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<p class="muted">لا توجد نتائج امتحانات بعد.</p>'}`;
}

const RECITE_STATUS_AR = { pending: 'بانتظار', in_progress: 'جارٍ', completed: 'مكتمل', reviewed: 'مقيّم ✅' };

function renderRecitation(rec) {
  if (!rec) return '';
  const rows = (rec.history || []).map((h, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${fmtDate(h.date)}</td>
      <td>${esc(h.newHifz || '—')}${h.newHifzScore !== null && h.newHifzScore !== undefined ? ` (${h.newHifzScore}%)` : ''}</td>
      <td>${esc(h.nearRevision || '—')}${h.nearRevisionScore !== null && h.nearRevisionScore !== undefined ? ` (${h.nearRevisionScore}%)` : ''}</td>
      <td>${RECITE_STATUS_AR[h.status] || esc(h.status || '—')}</td>
      <td>${esc(h.teacherNotes || '—')}</td>
    </tr>`).join('');
  return `
    <h2>التسميع والورد اليومي</h2>
    <div class="cards">
      <div class="card"><b>${rec.total ?? 0}</b><span>أيام مسجلة</span></div>
      <div class="card"><b>${rec.evaluated ?? 0}</b><span>أيام مقيّمة</span></div>
    </div>
    ${rows ? `<table><thead><tr><th>#</th><th>التاريخ</th><th>الحفظ الجديد (الدرجة)</th><th>الماضي (الدرجة)</th><th>الحالة</th><th>ملاحظات المعلم</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<p class="muted">لا توجد أوراد مسجلة بعد.</p>'}`;
}

// renderer عام لأي قسم مستقبلي: كائنات/قوائم تُعرض كجداول تلقائياً
function renderGeneric(title, data) {
  if (data === null || data === undefined) return '';
  if (Array.isArray(data)) {
    if (!data.length) return `<h2>${esc(title)}</h2><p class="muted">لا توجد بيانات.</p>`;
    const cols = [...new Set(data.flatMap(o => (o && typeof o === 'object' ? Object.keys(o) : [])))].slice(0, 8);
    const rows = data.map((o, i) => `<tr><td>${i + 1}</td>${cols.map(c => `<td>${esc(typeof o?.[c] === 'object' ? JSON.stringify(o?.[c] ?? '') : o?.[c] ?? '')}</td>`).join('')}</tr>`).join('');
    return `<h2>${esc(title)}</h2><table><thead><tr><th>#</th>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
  }
  if (typeof data === 'object') {
    const rows = Object.entries(data)
      .filter(([, v]) => v === null || typeof v !== 'object')
      .map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v ?? '—')}</td></tr>`).join('');
    const nested = Object.entries(data).filter(([, v]) => v && typeof v === 'object');
    return `<h2>${esc(title)}</h2>${rows ? `<table><tbody>${rows}</tbody></table>` : ''}${nested.map(([k, v]) => renderGeneric(k, v)).join('')}`;
  }
  return `<h2>${esc(title)}</h2><p>${esc(data)}</p>`;
}

const SECTION_TITLES = { attendance: 'الحضور والغياب', exams: 'نتائج الامتحانات', recitation: 'التسميع والورد اليومي' };

function buildHtml(report) {
  const { student: s, sections = {}, generatedAt } = report;
  const name = `${s?.firstName || ''} ${s?.lastName || ''}`.trim() || 'الطالب';

  const body = Object.entries(sections).map(([key, data]) => {
    if (key === 'attendance') return renderAttendance(data);
    if (key === 'exams') return renderExams(data);
    if (key === 'recitation') return renderRecitation(data);
    return renderGeneric(SECTION_TITLES[key] || key, data);
  }).join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><title>تقرير الطالب - ${esc(name)}</title>
<style>
  * { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; box-sizing: border-box; }
  body { margin: 0; padding: 24px; color: #1f2937; }
  .header { border: 2px solid #177B58; border-radius: 14px; padding: 18px 20px; margin-bottom: 20px; }
  .header h1 { margin: 0 0 6px; font-size: 22px; color: #0F5940; }
  .header p { margin: 2px 0; font-size: 13px; color: #555; }
  h2 { font-size: 17px; color: #0F5940; border-bottom: 2px solid #E2EFE7; padding-bottom: 6px; margin: 26px 0 12px; }
  .cards { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
  .card { flex: 1; min-width: 100px; background: #F8FAF8; border: 1px solid #E2EFE7; border-radius: 12px; padding: 10px; text-align: center; }
  .card b { display: block; font-size: 20px; color: #0F5940; }
  .card span { font-size: 12px; color: #666; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 8px; }
  th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: right; }
  th { background: #E2EFE7; color: #0F5940; }
  tr:nth-child(even) td { background: #fafafa; }
  .muted { color: #888; font-size: 13px; }
  .footer { margin-top: 28px; font-size: 12px; color: #888; text-align: center; border-top: 1px solid #eee; padding-top: 10px; }
  @media print { body { padding: 0; } .no-print { display: none; } }
</style></head>
<body>
  <div class="header">
    <h1>تقرير الطالب: ${esc(name)}</h1>
    <p>البريد: ${esc(s?.email || '—')} · الهاتف: ${esc(s?.phone || '—')} · الدولة: ${esc(s?.country || '—')}</p>
    <p>المستوى: ${esc(s?.assignedLevel || 'غير محدد')} · النظام: فردي 1-1 · الحالة: ${s?.isApproved ? 'معتمد' : 'بانتظار الاعتماد'}</p>
    <p>تاريخ إصدار التقرير: ${fmtDate(generatedAt)}</p>
  </div>
  ${body}
  <div class="footer">تقرير تلقائي من منصة التحفيظ — ${fmtDate(generatedAt)}</div>
  <div class="no-print" style="text-align:center; margin-top:16px;">
    <button onclick="window.print()" style="background:#177B58;color:#fff;border:none;border-radius:10px;padding:12px 32px;font-size:15px;font-weight:700;cursor:pointer;">طباعة / حفظ PDF</button>
  </div>
</body></html>`;
}

export async function downloadStudentReport(student) {
  const id = student?._id || student;
  const res = await api.get(`/reports/student/${id}`);
  const win = window.open('', '_blank');
  if (!win) throw new Error('popup-blocked');
  win.document.write(buildHtml(res.data));
  win.document.close();
  win.focus();
}
