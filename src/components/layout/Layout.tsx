
import React from 'react';
import Navbar from './Navbar';
// import Chatbot from '../Chatbot'; // Synchronous import removed

const Chatbot = React.lazy(() => import('../Chatbot'));

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col bg-app-neutral-light">
      <Navbar />
      <main className="flex-1">
        {children}
      </main>
      <footer className="py-4 px-6 bg-white border-t border-gray-200 text-center text-sm text-gray-500">
        CognitiveLens © {new Date().getFullYear()} - Supporting cognitive assessment and learning
      </footer>

      {/* Global Chatbot - Lazy Loaded */}
      <React.Suspense fallback={null}>
        <Chatbot />
      </React.Suspense>
    </div>
  );
};

export default Layout;
