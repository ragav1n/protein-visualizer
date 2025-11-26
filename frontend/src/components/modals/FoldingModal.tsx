import { useState, useEffect } from 'react';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { apiClient } from '../../api/client';
import { Info } from 'lucide-react';

interface FoldingModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  onLog: (action: string, data: unknown) => void;
  onToast: (message: string, type: 'error' | 'success' | 'info') => void;
}

export function FoldingModal({
  isOpen,
  onClose,
  jobId,
  onLog,
  onToast,
}: FoldingModalProps) {
  const [sequence, setSequence] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<unknown | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSequence('');
      setResult(null);
    }
  }, [isOpen]);

  const validateSequence = (seq: string): boolean => {
    const validAminoAcids = 'ACDEFGHIKLMNPQRSTVWY';
    const cleanSeq = seq.toUpperCase().replace(/\s/g, '');
    return cleanSeq.split('').every((char) => validAminoAcids.includes(char));
  };

  const handleSubmit = async () => {
    const cleanSequence = sequence.toUpperCase().replace(/\s/g, '');

    if (!cleanSequence) {
      onToast('Please enter a sequence', 'error');
      return;
    }

    if (!validateSequence(cleanSequence)) {
      onToast('Invalid amino acid sequence. Use only standard one-letter codes (A-Z)', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiClient.startFolding(jobId, cleanSequence);
      setResult(response);
      onLog('Start Folding', response);
      onToast('Folding job submitted successfully!', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start folding';
      onToast(message, 'error');
      onLog('Start Folding Error', { error: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = sequence.trim() && validateSequence(sequence);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Protein Folding">
      <div className="space-y-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex gap-2">
          <Info className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-emerald-800">
            <p className="font-medium mb-1">Enter amino acid sequence</p>
            <p>Use standard one-letter codes: A, C, D, E, F, G, H, I, K, L, M, N, P, Q, R, S, T, V, W, Y</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Amino Acid Sequence
          </label>
          <textarea
            value={sequence}
            onChange={(e) => setSequence(e.target.value)}
            placeholder="MKTIIALSYIFCLVFADYKDDDDK"
            rows={6}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent font-mono text-sm transition-all ${sequence && !isValid ? 'border-red-300 bg-red-50/30' : 'border-teal-200 bg-white/50 backdrop-blur-sm'
              }`}
          />
          <div className="mt-1 flex justify-between text-xs">
            <span className={sequence && !isValid ? 'text-red-600 font-medium' : 'text-slate-500'}>
              {sequence && !isValid ? 'Invalid sequence' : 'Valid sequence format'}
            </span>
            <span className="text-slate-500">
              {sequence.replace(/\s/g, '').length} residues
            </span>
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          loading={isSubmitting}
          disabled={!isValid}
          className="w-full"
        >
          Start Folding
        </Button>

        {!!result && (
          <div className="border-t border-teal-100 pt-4">
            <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-lg p-4 border border-teal-100">
              <h4 className="font-bold text-slate-900 mb-3">Folding Result</h4>
              <pre className="text-xs text-slate-700 bg-white p-3 rounded-lg overflow-auto max-h-64 border border-teal-100 font-mono">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
