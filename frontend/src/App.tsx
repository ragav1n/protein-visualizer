import { AppProvider } from './context/AppContext';
import { useRouter } from './utils/router';
import { HomePage } from './pages/HomePage';
import { JobDashboard } from './pages/JobDashboard';

function AppContent() {
  const { path } = useRouter();

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
