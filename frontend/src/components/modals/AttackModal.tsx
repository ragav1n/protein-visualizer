import { useState, useEffect, useRef } from 'react';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { apiClient, AttackResult } from '../../api/client';
import { Loader2, AlertTriangle } from 'lucide-react';

interface AttackModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  pdbId: string;
  atomIndex: number | null;
  onLog: (action: string, data: unknown) => void;
  onToast: (message: string, type: 'error' | 'success' | 'info') => void;
}

export function AttackModal({
  isOpen,
  onClose,
  jobId,
  pdbId,
  atomIndex,
  onLog,
  onToast,
}: AttackModalProps) {
  const [targetPdbId, setTargetPdbId] = useState(pdbId);
  const [targetAtomIndex, setTargetAtomIndex] = useState<number | null>(atomIndex);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attackId, setAttackId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [result, setResult] = useState<AttackResult | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setTargetPdbId(pdbId);
    setTargetAtomIndex(atomIndex);
  }, [pdbId, atomIndex]);

  useEffect(() => {
    if (!isOpen) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      setAttackId(null);
      setIsPolling(false);
      setResult(null);
    }
  }, [isOpen]);

  const startPolling = (atkId: string) => {
    setIsPolling(true);
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const attackResult = await apiClient.getAttackResult(jobId, atkId);
        onLog('Attack Result Poll', attackResult);

        if (attackResult.status === 'completed' || attackResult.status === 'failed') {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
          setIsPolling(false);
          setResult(attackResult);

          if (attackResult.status === 'completed') {
            onToast('Attack analysis completed successfully!', 'success');
          } else {
            onToast('Attack analysis failed', 'error');
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 3000);
  };

  const handleSubmit = async () => {
    if (targetAtomIndex === null) {
      onToast('Please select an atom index', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiClient.startAttack(jobId, targetPdbId, targetAtomIndex);

      onLog('Start Attack', response);
      setAttackId(response.attack_id);
      onToast('Attack analysis started. Polling for results...', 'info');
      startPolling(response.attack_id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start attack';
      onToast(message, 'error');
      onLog('Start Attack Error', { error: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Attack Analysis">
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium mb-1">Adversarial Attack Analysis</p>
            <p>This will perform a targeted attack analysis on the specified atom.</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            PDB ID
          </label>
          <input
            type="text"
            value={targetPdbId}
            onChange={(e) => setTargetPdbId(e.target.value)}
            className="bio-input"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Atom Index
          </label>
          <input
            type="number"
            value={targetAtomIndex ?? ''}
            onChange={(e) => setTargetAtomIndex(e.target.value ? parseInt(e.target.value) : null)}
            className="bio-input"
            placeholder="Select an atom from the table"
          />
          {targetAtomIndex !== null && (
            <p className="mt-2 text-sm text-emerald-700 font-medium">
              Target: Atom {targetAtomIndex}
            </p>
          )}
        </div>

        <Button
          onClick={handleSubmit}
          loading={isSubmitting}
          disabled={targetAtomIndex === null || isPolling}
          className="w-full"
        >
          Start Attack Analysis
        </Button>

        {attackId && (
          <div className="border-t border-teal-100 pt-4">
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-4">
              <p className="text-sm text-emerald-800">
                <span className="font-semibold">Attack ID:</span> {attackId}
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
              <h4 className="font-bold text-slate-900 mb-3">Attack Analysis Result</h4>
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

                {result.report && (
                  <div className="mt-3">
                    <p className="text-slate-700 font-semibold mb-2">Analysis Report:</p>
                    <div className="bg-white rounded-lg p-3 overflow-auto max-h-64 border border-teal-100">
                      <pre className="text-xs text-slate-700 font-mono">
                        {JSON.stringify(result.report, null, 2)}
                      </pre>
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
