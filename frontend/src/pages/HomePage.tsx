import { useState, useEffect } from 'react';
import { Upload, Clock, ArrowRight } from 'lucide-react';
import { apiClient, JobSummary } from '../api/client';
import { useApp } from '../context/AppContext';
import { useRouter, routes } from '../utils/router';
import { Header } from '../components/shared/Header';
import { Button } from '../components/shared/Button';
import { Toast } from '../components/shared/Toast';

export function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<unknown | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const { setJobId, setPdbId } = useApp();
  const { navigate } = useRouter();

  const loadJobs = async () => {
    setRefreshing(true);
    try {
      const data = await apiClient.getJobs();
      setJobs(data.jobs);
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResponse(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.toLowerCase().endsWith('.pdb')) {
      setFile(droppedFile);
      setResponse(null);
    } else {
      setToast({ message: 'Please drop a valid .pdb file', type: 'error' });
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setToast({ message: 'Please select a PDB file first', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const result = await apiClient.uploadPDB(file);
      setResponse(result);
      setJobId(result.job_id);
      setPdbId(result.pdb_id);
      setToast({ message: 'PDB file uploaded successfully!', type: 'success' });
      loadJobs(); // Refresh list
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : 'Upload failed',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenJob = () => {
    if (response && typeof response === 'object' && 'job_id' in response) {
      navigate(routes.job((response as { job_id: string }).job_id));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-slate-50">
      <Header />

      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="bio-card p-8 md:p-12 mb-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bio-gradient mb-6">
              <Upload className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-teal-600 via-emerald-600 to-green-600 bg-clip-text text-transparent mb-3">
              Analyze Your Protein Structure
            </h2>
            <p className="text-slate-600 text-lg max-w-2xl mx-auto">
              Upload a PDB file to begin comprehensive molecular analysis including pocket detection, docking, and refinement
            </p>
          </div>

          <div className="space-y-8">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                PDB File
              </label>
              <div
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${isDragging
                    ? 'border-teal-500 bg-teal-50 scale-[1.02]'
                    : 'border-slate-300 hover:border-teal-400 hover:bg-slate-50'
                  }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept=".pdb"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="pointer-events-none">
                  <Upload className={`w-10 h-10 mx-auto mb-3 transition-colors ${isDragging ? 'text-teal-600' : 'text-slate-400'}`} />
                  <p className="text-sm font-medium text-slate-700">
                    {file ? file.name : 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Supports .pdb files
                  </p>
                </div>
              </div>
              {file && (
                <div className="mt-3 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  Selected: <span className="font-semibold">{file.name}</span>
                </div>
              )}
            </div>

            <Button
              onClick={handleUpload}
              loading={loading}
              disabled={!file}
              className="w-full text-lg py-3"
            >
              <Upload className="w-5 h-5" />
              Upload PDB File
            </Button>

            {response !== null && (
              <div className="section-divider" />
            )}

            {response !== null && (
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-slate-900">Upload Successful</h3>
                  <Button onClick={handleOpenJob} variant="secondary">
                    Open Dashboard
                  </Button>
                </div>
                <div className="bg-white/80 rounded-xl p-6 overflow-auto border border-teal-100">
                  <pre className="text-sm text-slate-700 font-mono">
                    {JSON.stringify(response, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>

        {jobs.length > 0 && (
          <div className="bio-card p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900">Recent Activity</h2>
              <Button
                variant="secondary"
                onClick={loadJobs}
                disabled={refreshing}
                className="text-sm"
              >
                Refresh
              </Button>
            </div>
            <div className="space-y-4">
              {jobs.map((job) => (
                <div
                  key={job.job_id}
                  className="group flex items-center justify-between p-4 rounded-xl border border-teal-100 hover:border-teal-300 hover:bg-teal-50/50 transition-all"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-semibold text-teal-700">{job.job_id}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${job.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                        {job.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {job.created_at || 'Recently'}
                      </span>
                      <span>{job.molecules?.length || 0} molecules</span>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => navigate(routes.job(job.job_id))}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    View <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

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
