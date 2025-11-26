import { useState, useEffect } from 'react';
import { ExternalLink, Loader2, Box } from 'lucide-react';
import { apiClient, MoleculeData, Pocket } from '../api/client';
import { useApp } from '../context/AppContext';
import { useParams } from '../utils/router';
import { Header } from '../components/shared/Header';
import { Button } from '../components/shared/Button';
import { Toast } from '../components/shared/Toast';
import { MoleculeViewer } from '../components/MoleculeViewer';
import { ActivityLog, LogEntry } from '../components/ActivityLog';
import { DockingModal } from '../components/modals/DockingModal';
import { RefinementModal } from '../components/modals/RefinementModal';
import { FoldingModal } from '../components/modals/FoldingModal';
import { AttackModal } from '../components/modals/AttackModal';
import { ColorMode, RenderMode } from '../components/CanvasMoleculeViewer';
import { API_BASE_URL } from '../config';

export function JobDashboard() {
  const { jobId: contextJobId, pdbId, setPdbId, selectedAtomIndex, setSelectedAtomIndex } = useApp();
  const { jobId: routeJobId } = useParams();
  const jobId = routeJobId || contextJobId;

  const [moleculeData, setMoleculeData] = useState<MoleculeData | null>(null);
  const [pockets, setPockets] = useState<Pocket[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);

  const [isDockingModalOpen, setIsDockingModalOpen] = useState(false);
  const [isRefinementModalOpen, setIsRefinementModalOpen] = useState(false);
  const [isFoldingModalOpen, setIsFoldingModalOpen] = useState(false);
  const [isAttackModalOpen, setIsAttackModalOpen] = useState(false);

  // Visualization State
  const [colorMode, setColorMode] = useState<ColorMode>('element');
  const [renderMode, setRenderMode] = useState<RenderMode>('ball-and-stick');
  const [showLabels, setShowLabels] = useState(false);

  const addLog = (action: string, data: unknown) => {
    setLogs((prev) => [
      {
        id: Date.now().toString(),
        timestamp: new Date(),
        action,
        data,
      },
      ...prev,
    ]);
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

  const handlePreprocess = async () => {
    if (!jobId || !pdbId) return;

    setLoading((prev) => ({ ...prev, preprocess: true }));
    try {
      const data = await apiClient.preprocess(jobId, pdbId);
      addLog('Preprocess', data);
      setToast({ message: 'Preprocessing completed', type: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Preprocessing failed';
      setToast({ message, type: 'error' });
      addLog('Preprocess Error', { error: message });
    } finally {
      setLoading((prev) => ({ ...prev, preprocess: false }));
    }
  };

  const handleDetectPockets = async () => {
    if (!jobId || !pdbId) return;

    setLoading((prev) => ({ ...prev, pockets: true }));
    try {
      const data = await apiClient.detectPockets(jobId, pdbId);
      setPockets(data.pockets || []);
      addLog('Detect Pockets', data);
      setToast({
        message: `Found ${data.pockets?.length || 0} pockets`,
        type: 'success',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Pocket detection failed';
      setToast({ message, type: 'error' });
      addLog('Detect Pockets Error', { error: message });
    } finally {
      setLoading((prev) => ({ ...prev, pockets: false }));
    }
  };

  useEffect(() => {
    const initJob = async () => {
      if (!jobId) return;

      // If we have both IDs, just load the molecule
      if (pdbId) {
        handleLoadMolecule();
        return;
      }

      // If missing pdbId (e.g. reload or history), fetch job details first
      setLoading((prev) => ({ ...prev, molecule: true }));
      try {
        const job = await apiClient.getJob(jobId);
        if (job.molecules && job.molecules.length > 0) {
          const firstPdbId = job.molecules[0];
          setPdbId(firstPdbId);
          // Now load molecule with the recovered ID
          const data = await apiClient.getMolecule(jobId, firstPdbId);
          setMoleculeData(data);
          addLog('Load Molecule', data);
          setToast({ message: 'Job restored successfully', type: 'success' });
        } else {
          setToast({ message: 'No molecules found in this job', type: 'error' });
        }
      } catch (error) {
        console.error('Failed to restore job:', error);
        setToast({ message: 'Failed to restore job session', type: 'error' });
      } finally {
        if (jobId && pdbId) {
          handleLoadMolecule();
        }
        setLoading((prev) => ({ ...prev, molecule: false }));
      }
    };

    initJob();
  }, [jobId, pdbId]);

  if (!jobId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-slate-50">
        <Header />
        <div className="max-w-7xl mx-auto px-6 py-12 text-center">
          <p className="text-slate-600">No job ID found. Please upload a PDB file first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-slate-50">
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="bio-card p-6 mb-6 border-teal-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
                Molecular Analysis Dashboard
              </h2>
              <div className="flex gap-6 mt-3 text-sm text-slate-600">
                <span>
                  Job ID: <span className="font-mono font-semibold text-teal-700">{jobId}</span>
                </span>
                {pdbId && (
                  <span>
                    PDB ID: <span className="font-mono font-semibold text-teal-700">{pdbId}</span>
                  </span>
                )}
              </div>
            </div>
            <a
              href={`${API_BASE_URL}/docs`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-medium text-teal-700 hover:text-teal-900 transition-colors p-3 hover:bg-teal-50 rounded-lg"
            >
              Backend Docs
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="bio-card p-6 border-teal-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-500">
                    <Box className="w-5 h-5 text-white" />
                  </div>
                  Molecule Data
                </h3>
                <Button
                  onClick={handleLoadMolecule}
                  loading={loading.molecule}
                  variant="secondary"
                  className="text-sm"
                >
                  {moleculeData ? 'Reload' : 'Load Molecule'}
                </Button>
              </div>

              {/* Visualization Controls */}
              <div className="flex flex-wrap gap-4 mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Color Mode</label>
                  <div className="flex gap-2">
                    {(['element', 'residue', 'hydrophobicity', 'bfactor'] as ColorMode[]).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setColorMode(mode)}
                        className={`px-3 py-1 text-xs rounded-full border transition-colors ${colorMode === mode
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-white text-slate-600 border-slate-300 hover:border-teal-400'
                          }`}
                      >
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Render Mode</label>
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
                        {mode.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Options</label>
                  <div>
                    <button
                      onClick={() => setShowLabels(!showLabels)}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${showLabels
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white text-slate-600 border-slate-300 hover:border-teal-400'
                        }`}
                    >
                      Show Labels
                    </button>
                  </div>
                </div>
              </div>

              {moleculeData ? (
                <MoleculeViewer
                  moleculeData={moleculeData}
                  selectedAtomIndex={selectedAtomIndex}
                  onAtomSelect={setSelectedAtomIndex}
                  colorMode={colorMode}
                  renderMode={renderMode}
                  showLabels={showLabels}
                />
              ) : (
                <div className="text-center py-12 text-slate-500">
                  {loading.molecule ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                      Loading molecule...
                    </div>
                  ) : (
                    <p className="font-medium">Click "Load Molecule" to view structure</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bio-card p-6 border-teal-200">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Analysis Actions</h3>

              <div className="space-y-3">
                <Button
                  onClick={handlePreprocess}
                  loading={loading.preprocess}
                  disabled={!pdbId}
                  className="w-full"
                >
                  Preprocess
                </Button>

                <Button
                  onClick={handleDetectPockets}
                  loading={loading.pockets}
                  disabled={!pdbId}
                  className="w-full"
                >
                  Detect Pockets
                </Button>

                {pockets.length > 0 && (
                  <div className="text-sm font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    {pockets.length} pocket{pockets.length !== 1 ? 's' : ''} detected
                  </div>
                )}

                <div className="section-divider" />

                <div className="space-y-3">
                  <Button
                    onClick={() => setIsDockingModalOpen(true)}
                    disabled={!pdbId}
                    className="w-full"
                  >
                    Start Docking
                  </Button>

                  <Button
                    onClick={() => setIsRefinementModalOpen(true)}
                    disabled={!pdbId}
                    className="w-full"
                    variant="secondary"
                  >
                    Start Refinement
                  </Button>

                  <Button
                    onClick={() => setIsFoldingModalOpen(true)}
                    className="w-full"
                    variant="secondary"
                  >
                    Start Folding
                  </Button>

                  <Button
                    onClick={() => setIsAttackModalOpen(true)}
                    disabled={!pdbId || selectedAtomIndex === null}
                    className="w-full"
                    variant="secondary"
                  >
                    Attack {selectedAtomIndex !== null && `(Atom ${selectedAtomIndex})`}
                  </Button>
                </div>
              </div>
            </div>

            <ActivityLog logs={logs} />
          </div>
        </div>


      </main >

      <DockingModal
        isOpen={isDockingModalOpen}
        onClose={() => setIsDockingModalOpen(false)}
        jobId={jobId}
        pdbId={pdbId || ''}
        pockets={pockets}
        onLog={addLog}
        onToast={(message, type) => setToast({ message, type })}
      />

      <RefinementModal
        isOpen={isRefinementModalOpen}
        onClose={() => setIsRefinementModalOpen(false)}
        jobId={jobId}
        pdbId={pdbId || ''}
        onLog={addLog}
        onToast={(message, type) => setToast({ message, type })}
      />

      <FoldingModal
        isOpen={isFoldingModalOpen}
        onClose={() => setIsFoldingModalOpen(false)}
        jobId={jobId}
        onLog={addLog}
        onToast={(message, type) => setToast({ message, type })}
      />

      <AttackModal
        isOpen={isAttackModalOpen}
        onClose={() => setIsAttackModalOpen(false)}
        jobId={jobId}
        pdbId={pdbId || ''}
        atomIndex={selectedAtomIndex}
        onLog={addLog}
        onToast={(message, type) => setToast({ message, type })}
      />

      {
        toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )
      }
    </div >
  );
}
