import { Toaster } from 'sonner';

export default function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: '#1e293b',
          border: '1px solid #334155',
          color: '#e2e8f0',
          fontFamily: 'ui-monospace, monospace',
        },
        className: 'toast-custom',
      }}
      closeButton
      richColors
      expand
      visibleToasts={5}
    />
  );
}
