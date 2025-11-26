import { Dna } from 'lucide-react';
import { useRouter } from '../../utils/router';

export function Header() {
  const { navigate } = useRouter();

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-teal-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigate('/')}
        >
          <div className="p-2 rounded-lg bio-gradient">
            <Dna className="w-6 h-6 text-white animate-float" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
              Proteins-EL
            </h1>
            <p className="text-xs text-slate-500 font-medium">Molecular Analysis Platform</p>
          </div>
        </div>
      </div>
    </header>
  );
}
