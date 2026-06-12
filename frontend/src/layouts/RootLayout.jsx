import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useUIStore } from '../store';

function RootLayout() {
  const sidebarCollapsed = useUIStore(state => state.isSidebarCollapsed());

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* Sidebar - full height, fixed on desktop, drawer on mobile */}
      <Sidebar />

      {/* Main Content Area - fills remaining space */}
      <main className="flex-1 h-screen flex flex-col">
        {/* Content outlet - takes all available space except composer */}
        <div className="flex-1 min-h-0 w-full overflow-y-auto flex flex-col">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default RootLayout;