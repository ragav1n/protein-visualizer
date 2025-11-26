import { ReactNode, useState, useEffect } from 'react';

export const routes = {
  home: () => '/',
  job: (jobId: string) => `/job/${jobId}`,
};

export function useRouter() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => {
      setPath(window.location.pathname);
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('pushstate', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('pushstate', handleLocationChange);
    };
  }, []);

  const navigate = (newPath: string) => {
    window.history.pushState({}, '', newPath);
    window.dispatchEvent(new Event('pushstate'));
  };

  return { path, navigate };
}

export function Route({ path, children }: { path: string; children: ReactNode }) {
  const { path: currentPath } = useRouter();

  const pathRegex = new RegExp(`^${path.replace(/:\w+/g, '([^/]+)')}$`);
  const match = currentPath.match(pathRegex);

  if (!match) return null;

  return <>{children}</>;
}

export function useParams(): Record<string, string> {
  const { path: currentPath } = useRouter();
  const pathParts = currentPath.split('/').filter(Boolean);

  if (pathParts[0] === 'job' && pathParts[1]) {
    return { jobId: pathParts[1] };
  }

  return {};
}
