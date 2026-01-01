import { AppProvider } from './context/AppContext';
import { useRouter } from './utils/router';
import { HomePage } from './pages/HomePage';
import { JobDashboard } from './pages/JobDashboard';
import { DockingPage } from './pages/DockingPage';

function AppContent() {
  const { path } = useRouter();

  if (path.includes('/docking')) {
    return <DockingPage />;
  }

  if (path.startsWith('/job/')) {
    return <JobDashboard />;
  }

  return <HomePage />;
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
