import { useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';

export default function PdfThumbnail({ url, className = '' }) {
  const canvasRef = useRef(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    if (!url) { setStatus('error'); return; }
    let cancelled = false;

    const render = async () => {
      try {
        if (!window.pdfjsLib) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }

        const loadingTask = window.pdfjsLib.getDocument({
          url,
          withCredentials: false,
          cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
          cMapPacked: true,
        });

        const pdf = await loadingTask.promise;
        if (cancelled) return;

        const page = await pdf.getPage(1);
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const viewport = page.getViewport({ scale: 1.5 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;

        if (!cancelled) setStatus('done');
      } catch (e) {
        console.warn('PDF thumbnail error:', e);
        if (!cancelled) setStatus('error');
      }
    };

    render();
    return () => { cancelled = true; };
  }, [url]);

  if (status === 'error') return (
    <div className={`flex flex-col items-center justify-center bg-gray-50 text-gray-400 ${className}`}>
      <FileText className="h-10 w-10 mb-1" />
      <span className="text-xs">PDF</span>
    </div>
  );

  return (
    <div className={`relative overflow-hidden bg-white ${className}`}>
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 text-gray-400">
          <FileText className="h-10 w-10 mb-1 animate-pulse" />
          <span className="text-xs">Loading preview...</span>
        </div>
      )}
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: status === 'done' ? 'block' : 'none'
        }}
      />
    </div>
  );
}
