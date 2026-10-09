import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App.jsx';
import ErrorBoundary from './components/shared/ErrorBoundary';
import './index.css';

// تسجيل Service Worker مبكراً لاستقبال Web Push حتى والموقع مغلق.
// التسجيل وحده لا يطلب إذناً ولا يشترك — الاشتراك يتم عند ضغط المستخدم زر التفعيل.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
      <Toaster
        position="top-center"
        reverseOrder={false}
        gutter={8}
        containerStyle={{ direction: 'rtl' }}
        toastOptions={{
          duration: 4000,
          style: {
            fontFamily: 'Tajawal, sans-serif',
            direction: 'rtl',
            textAlign: 'right',
            borderRadius: '12px',
            padding: '14px 18px',
            fontSize: '0.8125rem',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          },
          success: {
            iconTheme: { primary: '#177B58', secondary: '#fff' },
            style: { background: '#E2EFE7', color: '#0F5940', border: '1px solid #177B58' },
          },
          error: {
            iconTheme: { primary: '#C2410C', secondary: '#fff' },
            style: { background: '#FFFFFF', color: '#C2410C', border: '1px solid #C2410C' },
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);
