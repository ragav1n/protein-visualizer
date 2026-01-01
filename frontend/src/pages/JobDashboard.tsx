import { useState, useEffect } from 'react';
import { ExternalLink, Loader2, Box } from 'lucide-react';
import { apiClient, MoleculeData, Pocket } from '../api/client';
import { useApp } from '../context/AppContext';
import { useRouter, useParams } from '../utils/router';
import { Header } from '../components/shared/Header';
import { Button } from '../components/shared/Button';
import { Toast } from '../components/shared/Toast';
import { MoleculeViewer } from '../components/MoleculeViewer';
import { ActivityLog, LogEntry } from '../components/ActivityLog';
import { ColorMode, RenderMode } from '../components/CanvasMoleculeViewer';

export function JobDashboard() {
  const { jobId: contextJobId, pdbId, selectedAtomIndex, setSelectedAtomIndex } = useApp();
  const { jobId: routeJobId } = useParams();
  const { navigate } = useRouter();
  const jobId = routeJobId || contextJobId;

  const [moleculeData, setMoleculeData] = useState<MoleculeData | null>(null);
  const [pockets, setPockets] = useState<Pocket[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);

  // Visualization State
  const [colorMode, setColorMode] = useState<ColorMode>('element');
  const [renderMode, setRenderMode] = useState<RenderMode>('ball-and-stick');

  const addLog = (action: string, data: unknown) => {
    setLogs((prev) => [{ id: Math.random().toString(36), timestamp: new Date(), action, data }, ...prev]);
  };

  const handleLoadMolecule = async () => {
    if (!jobId || !pdbId) {
      setToast({ message: 'Job ID or PDB ID missing', type: 'error' });
      return;
    }

    setLoading((prev) => ({ ...prev, molecule: true }));
    try {
      const data = await apiClient.getMolecule(jobId, pdbId);
      setMoleculeData(data);
      addLog('Load Molecule', data);
      setToast({ message: 'Molecule loaded successfully', type: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load molecule';
      setToast({ message, type: 'error' });
      addLog('Load Molecule Error', { error: message });
    } finally {
      setLoading((prev) => ({ ...prev, molecule: false }));
    }
  };

  const handleDetectPockets = async () => {
    if (!jobId || !pdbId) return;

    setLoading((prev) => ({ ...prev, pockets: true }));
    try {
      const data = await apiClient.detectPockets(jobId, pdbId);
      setPockets(data.pockets || []);
      addLog('Detect Pockets', data);
      setToast({ message: `Detected ${data.pockets?.length || 0} pockets`, type: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to detect pockets';
      setToast({ message, type: 'error' });
      addLog('Detect Pockets Error', { error: message });
    } finally {
      setLoading((prev) => ({ ...prev, pockets: false }));
    }
  };

  useEffect(() => {
    const initJob = async () => {
      if (!jobId) return;

      if (pdbId) {
        handleLoadMolecule();
      }
    };
    initJob();
  }, [jobId, pdbId]);

  if (!jobId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-900">No Job Selected</h2>
          <Button onClick={() => window.location.href = '/'} className="mt-4">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Controls & Info */}
          <div className="space-y-6">
            {/* Job Info Card */}
            <div className="bio-card p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4">Job Details</h2>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-slate-500 block mb-1">Job ID</span>
                  <div className="font-mono bg-slate-100 px-3 py-1.5 rounded text-slate-700 select-all">
                    {jobId}
                  </div>
                </div>
                {pdbId && (
                  <div>
                    <span className="text-slate-500 block mb-1">PDB ID</span>
                    <div className="font-mono bg-slate-100 px-3 py-1.5 rounded text-slate-700">
                      {pdbId}
                    </div>
                  </div>
                )}
                {Object.keys(loading).some(k => loading[k]) && (
                  <div className="flex items-center gap-2 text-teal-600 bg-teal-50 px-3 py-2 rounded-lg">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="font-medium">Processing...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions Card */}
            <div className="bio-card p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4">Actions</h2>
              <div className="space-y-3">
                <Button
                  onClick={handleDetectPockets}
                  loading={loading.pockets}
                  disabled={!pdbId}
                  variant="secondary"
                  className="w-full justify-between group"
                >
                  <span>Detect Pockets</span>
                  {pockets.length > 0 && (
                    <span className="bg-teal-100 text-teal-700 px-2 py-0.5 rounded text-xs">
                      {pockets.length}
                    </span>
                  )}
                </Button>

                <Button
                  onClick={() => navigate(`/job/${jobId}/docking`)}
                  disabled={!pdbId}
                  className="w-full justify-between"
                  style={{ background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)' }}
                >
                  <span className="flex items-center gap-2">
                    <Box className="w-4 h-4" />
                    Open Docking Studio
                  </span>
                  <ExternalLink className="w-4 h-4 opacity-50" />
                </Button>
              </div>
            </div>

            {/* Pockets List */}
            {pockets.length > 0 && (
              <div className="bio-card p-6">
                <h2 className="text-lg font-bold text-slate-800 mb-4">Detected Pockets</h2>
                <div className="max-h-64 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {pockets.map((pocket) => (
                    <div
                      key={pocket.pocket_id}
                      className="p-3 rounded-lg border border-slate-200 hover:border-teal-300 transition-colors bg-white group cursor-pointer"
                      onClick={() => {
                        // Optional: Focus pocket in viewer
                        setToast({ message: `Selected Pocket ${pocket.pocket_id}`, type: 'info' });
                      }}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-slate-700">Pocket {pocket.pocket_id}</span>
                        <span className="text-xs font-mono text-teal-600 bg-teal-50 px-2 py-1 rounded">
                          Score: {pocket.score}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 grid grid-cols-3 gap-2 mt-2">
                        <div>
                          <span className="block opacity-50">Residues</span>
                          {(pocket.residues as any[])?.length || 0}
                        </div>
                        <div className="col-span-2">
                          <span className="block opacity-50">Center (x,y,z)</span>
                          {pocket.center && typeof pocket.center.x === 'number' ?
                            `${pocket.center.x.toFixed(1)}, ${pocket.center.y.toFixed(1)}, ${pocket.center.z.toFixed(1)}`
                            : 'N/A'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Center/Right: Visualization */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bio-card p-1 min-h-[600px] flex flex-col">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white rounded-t-xl">
                <div className="flex items-center gap-4">
                  <h2 className="font-bold text-slate-800">Molecular Viewer</h2>
                  <div className="h-4 w-px bg-slate-200"></div>
                  <div className="flex gap-2">
                    {(['element', 'residue', 'hydrophobicity', 'bfactor'] as ColorMode[]).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setColorMode(mode)}
                        className={`px-3 py-1 text-xs rounded-full border transition-colors ${colorMode === mode
                          ? 'bg-teal-50 text-teal-700 border-teal-200 font-medium'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-teal-200'
                          }`}
                      >
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex gap-2">
                    {(['ball-and-stick', 'space-filling'] as RenderMode[]).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setRenderMode(mode)}
                        className={`px-3 py-1 text-xs rounded-full border transition-colors ${renderMode === mode
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-white text-slate-600 border-slate-300 hover:border-teal-400'
                          }`}
                      >
                        {mode.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex-1 bg-slate-100 relative rounded-b-xl overflow-hidden">
                {moleculeData ? (
                  <MoleculeViewer
                    moleculeData={moleculeData}
                    selectedAtomIndex={selectedAtomIndex}
                    onAtomSelect={setSelectedAtomIndex}
                    colorMode={colorMode}
                    renderMode={renderMode}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                    <div className="text-center">
                      <Box className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p>Load a structure to visualize</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Activity Log Overlay (Optional) */}
      {logs.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50">
          <ActivityLog logs={logs} />
        </div>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
