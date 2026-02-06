import Navigation from './Navigation';
import ToastProvider from './ToastProvider';
import { useLeadNotifications } from '../hooks/useLeadNotifications';

function NotificationListener() {
  useLeadNotifications();
  return null;
}

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-slate-900">
      <ToastProvider />
      <NotificationListener />
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
