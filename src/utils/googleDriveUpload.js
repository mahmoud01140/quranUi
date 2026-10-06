import api from '../services/api';

/* الرفع المباشر من المتصفح إلى Google Drive (للمكتبة العامة فقط) عبر
   جلسة resumable يصدرها السيرفر — الملف لا يمر بالخادم أبداً.
   يُرجع driveFileId الذي يُرسل بعدها مع بيانات المورد للحفظ والتحقق. */

function xhrPut(url, file, mimeType, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', mimeType || 'application/octet-stream');
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText || '{}');
          if (data?.id) return resolve(data.id);
        } catch (_) {}
        // Empty-body completion (chunked sessions): fall through to error
        reject(new Error('اكتمل الرفع دون معرّف ملف — أعد المحاولة'));
      } else {
        reject(new Error('فشل رفع الملف إلى التخزين'));
      }
    };
    xhr.onerror = () => reject(new Error('انقطع الاتصال أثناء الرفع'));
    xhr.ontimeout = () => reject(new Error('انتهت مهلة الرفع — حاول مجدداً'));
    xhr.timeout = 15 * 60 * 1000;
    xhr.send(file);
  });
}

/**
 * Full Drive-direct flow for one File.
 * Returns { driveFileId } — throws when Drive direct isn't available so the
 * caller falls back to the Cloudinary/multipart path.
 */
export async function uploadFileToDriveDirect(file, { onProgress } = {}) {
  if (!file) throw new Error('لا يوجد ملف');
  // 1. Ask our server for a single-use, folder-bound upload session
  const sessionRes = await api.post('/resources/drive-session', {
    filename: file.name || `file-${Date.now()}`,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
  });
  const sessionUri = sessionRes.data?.sessionUri;
  if (!sessionUri) throw new Error('تعذر تجهيز جلسة الرفع');
  // 2. PUT the bytes straight to Google (bypasses our server entirely)
  const driveFileId = await xhrPut(sessionUri, file, file.type, onProgress);
  return { driveFileId };
}

export default uploadFileToDriveDirect;
