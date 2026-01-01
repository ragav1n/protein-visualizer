import { useState, useEffect, useRef } from 'react';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { apiClient, Pocket, DockingResult } from '../../api/client';
import { Loader2 } from 'lucide-react';

interface DockingModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  pdbId: string;
  pockets: Pocket[];
  onLog: (action: string, data: unknown) => void;
  onToast: (message: string, type: 'error' | 'success' | 'info') => void;
  onRender: (outputPdb: string) => void;
}

export function DockingModal({
  isOpen,
  onClose,
  jobId,
  pdbId,
  pockets,
  onLog,
  onToast,
}: DockingModalProps) {
  const [receptorPdbId, setReceptorPdbId] = useState(pdbId);
  const [ligandFile, setLigandFile] = useState<File | null>(null);
  const [selectedPocket, setSelectedPocket] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dockingId, setDockingId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [result, setResult] = useState<DockingResult | null>(null);
  const [selectedPose, setSelectedPose] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setReceptorPdbId(pdbId);
  }, [pdbId]);

  useEffect(() => {
    if (!isOpen) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      setDockingId(null);
      setIsPolling(false);
      setResult(null);
      setSelectedPose(null);
      setLigandFile(null);
      setSelectedPocket('');
    }
  }, [isOpen]);

  const startPolling = (dockId: string) => {
    setIsPolling(true);
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const dockingResult = await apiClient.getDockingResult(jobId, dockId);
        onLog('Docking Result Poll', dockingResult);

        if (dockingResult.status === 'completed' || dockingResult.status === 'done' || dockingResult.status === 'failed') {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
          setIsPolling(false);
          setResult(dockingResult);

          if (dockingResult.status === 'completed') {
            onToast('Docking completed successfully!', 'success');
          } else {
            onToast('Docking failed', 'error');
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 3000);
  };

  const handleSubmit = async () => {
    if (!ligandFile) {
      onToast('Please select a ligand file', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const pocketData = selectedPocket ? pockets.find((p) => p.pocket_id === selectedPocket) : undefined;
      const response = await apiClient.startDocking(jobId, receptorPdbId, ligandFile, pocketData);

      onLog('Start Docking', response);
      setDockingId(response.docking_id);
      onToast('Docking started. Polling for results...', 'info');
      startPolling(response.docking_id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start docking';
      onToast(message, 'error');
      onLog('Start Docking Error', { error: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Molecular Docking">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Receptor PDB ID
          </label>
          <input
            type="text"
            value={receptorPdbId}
            onChange={(e) => setReceptorPdbId(e.target.value)}
            className="bio-input"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Ligand File
          </label>
          <input
            type="file"
            onChange={(e) => setLigandFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-slate-600 file:mr-4 file:py-3 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bio-gradient file:text-white hover:file:shadow-lg transition-all cursor-pointer"
          />
          {ligandFile && (
            <p className="mt-2 text-sm text-emerald-700 font-medium">Selected: {ligandFile.name}</p>
          )}
        </div>

        {pockets.length > 0 && (
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Pocket (Optional)
            </label>
            <select
              value={selectedPocket}
              onChange={(e) => setSelectedPocket(e.target.value)}
              className="bio-input"
            >
              <option value="">None</option>
              {pockets.map((pocket) => (
                <option key={pocket.pocket_id} value={pocket.pocket_id}>
                  {pocket.pocket_id} {pocket.score ? `(Score: ${pocket.score})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <Button
          onClick={handleSubmit}
          loading={isSubmitting}
          disabled={!ligandFile || isPolling}
          className="w-full"
        >
          Start Docking
        </Button>

        {dockingId && (
          <div className="border-t border-teal-100 pt-4">
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-4">
              <p className="text-sm text-emerald-800">
                <span className="font-semibold">Docking ID:</span> {dockingId}
              </p>
              {isPolling && (
                <div className="flex items-center gap-2 mt-2 text-sm text-emerald-700">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Polling for results...
                </div>
              )}
            </div>
          </div>
        )}

        {result && (
          <div className="border-t border-teal-100 pt-4 space-y-3">
            <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-lg p-4 border border-teal-100">
              <h4 className="font-bold text-slate-900 mb-3">Docking Result</h4>
              <div className="space-y-2 text-sm">
                <p className="text-slate-700">
                  Status:{' '}
                  <span
                    className={`font-semibold ${result.status === 'done' || result.status === 'completed' ? 'text-emerald-700' : 'text-red-700'
                      }`}
                  >
                    {result.status}
                  </span>
                </p>

                {result.best_energy !== undefined && (
                  <p className="text-slate-900 font-medium">
                    Best Energy: <span className="text-emerald-700 text-lg font-bold">{result.best_energy.toFixed(2)} kcal/mol</span>
                  </p>
                )}

                {result.output_pdb && (
                  <div className="mt-4">
                    <p className="text-slate-600 mb-2">Output Generated:</p>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          onToast("Loaded out.pdb into viewer (Simulation)", "success");
                          onClose();
                          // In a real implementation, this would trigger a callback to load the file
                          // onLog('Load PDB', result.output_pdb);
                        }}
                      >
                        Render Docked Structure
                      </Button>
                    </div>
                  </div>
                )}

                {/* Legacy or Detailed Poses Fallback */}
                {result.poses && result.poses.length > 0 && (
                  <div className="mt-4">
                    <p className="text-slate-700 font-semibold mb-2">
                      Poses ({result.poses.length}):
                    </p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {result.poses.map((pose) => (
                        <div
                          key={pose.pose_id}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedPose === pose.pose_id
                            ? 'bg-emerald-50 border-emerald-300'
                            : 'bg-white border-teal-200 hover:border-teal-300'
                            }`}
                          onClick={() => setSelectedPose(pose.pose_id)}
                        >
                          <p className="font-semibold text-slate-900">{pose.pose_id}</p>
                          <p className="text-teal-700">Score: {pose.score}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-slate-600 hover:text-slate-800 font-medium">
                  View raw JSON
                </summary>
                <pre className="mt-2 text-xs text-slate-700 bg-white p-3 rounded-lg overflow-auto max-h-48 border border-teal-100 font-mono">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
