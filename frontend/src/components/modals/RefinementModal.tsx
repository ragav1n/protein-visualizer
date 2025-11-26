import { useState, useEffect, useRef } from 'react';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { apiClient, RefinementResult } from '../../api/client';
import { Loader2 } from 'lucide-react';

interface RefinementModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  pdbId: string;
  onLog: (action: string, data: unknown) => void;
  onToast: (message: string, type: 'error' | 'success' | 'info') => void;
}

export function RefinementModal({
  isOpen,
  onClose,
  jobId,
  pdbId,
  onLog,
  onToast,
}: RefinementModalProps) {
  const [receptorPdbId, setReceptorPdbId] = useState(pdbId);
  const [poseInput, setPoseInput] = useState<string>('');
  const [poseFile, setPoseFile] = useState<File | null>(null);
  const [useFileUpload, setUseFileUpload] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refinementId, setRefinementId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [result, setResult] = useState<RefinementResult | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setReceptorPdbId(pdbId);
  }, [pdbId]);

  useEffect(() => {
    if (!isOpen) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      setRefinementId(null);
      setIsPolling(false);
      setResult(null);
      setPoseInput('');
      setPoseFile(null);
    }
  }, [isOpen]);

  const startPolling = (refId: string) => {
    setIsPolling(true);
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const refinementResult = await apiClient.getRefinementResult(jobId, refId);
        onLog('Refinement Result Poll', refinementResult);

        if (refinementResult.status === 'completed' || refinementResult.status === 'failed') {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
          setIsPolling(false);
          setResult(refinementResult);

          if (refinementResult.status === 'completed') {
            onToast('Refinement completed successfully!', 'success');
          } else {
            onToast('Refinement failed', 'error');
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 3000);
  };

  const handleSubmit = async () => {
    const pose = useFileUpload ? poseFile : poseInput;

    if (!pose) {
      onToast('Please provide a pose file or path', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiClient.startRefinement(jobId, receptorPdbId, pose);

      onLog('Start Refinement', response);
      setRefinementId(response.refinement_id);
      onToast('Refinement started. Polling for results...', 'info');
      startPolling(response.refinement_id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start refinement';
      onToast(message, 'error');
      onLog('Start Refinement Error', { error: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Structure Refinement">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            PDB ID
          </label>
          <input
            type="text"
            value={receptorPdbId}
            onChange={(e) => setReceptorPdbId(e.target.value)}
            className="bio-input"
          />
        </div>

        <div className="flex items-center gap-2 mb-2">
          <input
            type="checkbox"
            id="useFileUpload"
            checked={useFileUpload}
            onChange={(e) => setUseFileUpload(e.target.checked)}
            className="rounded accent-teal-600"
          />
          <label htmlFor="useFileUpload" className="text-sm font-medium text-slate-700">
            Upload pose file instead of path
          </label>
        </div>

        {useFileUpload ? (
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Pose File
            </label>
            <input
              type="file"
              onChange={(e) => setPoseFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-600 file:mr-4 file:py-3 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bio-gradient file:text-white hover:file:shadow-lg transition-all cursor-pointer"
            />
            {poseFile && (
              <p className="mt-2 text-sm text-emerald-700 font-medium">Selected: {poseFile.name}</p>
            )}
          </div>
        ) : (
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Pose File Path
            </label>
            <input
              type="text"
              value={poseInput}
              onChange={(e) => setPoseInput(e.target.value)}
              placeholder="/path/to/pose.pdb"
              className="bio-input"
            />
          </div>
        )}

        <Button
          onClick={handleSubmit}
          loading={isSubmitting}
          disabled={(!poseInput && !poseFile) || isPolling}
          className="w-full"
        >
          Start Refinement
        </Button>

        {refinementId && (
          <div className="border-t border-teal-100 pt-4">
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-4">
              <p className="text-sm text-emerald-800">
                <span className="font-semibold">Refinement ID:</span> {refinementId}
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
              <h4 className="font-bold text-slate-900 mb-3">Refinement Result</h4>
              <div className="space-y-2 text-sm">
                <p className="text-slate-700">
                  Status:{' '}
                  <span
                    className={`font-semibold ${result.status === 'completed' ? 'text-emerald-700' : 'text-red-700'
                      }`}
                  >
                    {result.status}
                  </span>
                </p>

                {result.files && result.files.length > 0 && (
                  <div>
                    <p className="text-slate-700 font-semibold mb-2">Output Files:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {result.files.map((file, idx) => (
                        <li key={idx} className="text-teal-700 text-xs font-mono">
                          {file}
                        </li>
                      ))}
                    </ul>
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
