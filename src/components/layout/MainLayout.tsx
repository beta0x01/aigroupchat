import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { MainSidebar } from '../sidebar/MainSidebar';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
  const location = useLocation();
  const isChatView = location.pathname.includes('/chat/');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen bg-gradient-primary text-white">
      {!isChatView && (
        <>
          {/* Mobile overlay */}
          <div
            className={`fixed inset-y-0 left-0 z-50 transform bg-gray-800 transition-transform ${  
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="md:hidden flex justify-end p-2">
              <button
                className="p-2 rounded hover:bg-gray-700"
                onClick={() => setSidebarOpen(false)}
              >
                <X />
              </button>
            </div>
            <MainSidebar />
          </div>
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </>
      )}
      <main className="relative flex-1 flex flex-col overflow-y-auto">
        {!isChatView && (
          <button
            className="absolute top-4 left-4 z-10 p-2 rounded hover:bg-gray-800"  
            onClick={() => setSidebarOpen(!sidebarOpen)}  
          >
            {sidebarOpen ? <X /> : <Menu />}
          </button>
        )}
        <div className={`flex-1 flex flex-col ${!isChatView ? 'pt-16 md:pt-0' : ''}`}>{children}</div>
      </main>
    </div>
  );
};

export default MainLayout;