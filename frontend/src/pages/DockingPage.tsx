import { useState, useEffect } from 'react';
import { ArrowLeft, Upload, Play, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useRouter } from '../utils/router';
import { useApp } from '../context/AppContext';
import { apiClient, Pocket, DockingResult, MoleculeData } from '../api/client';
import { Header } from '../components/shared/Header';
import { Button } from '../components/shared/Button';
import { Toast } from '../components/shared/Toast';
import { MoleculeViewer } from '../components/MoleculeViewer';

export function DockingPage() {
    const { jobId, pdbId } = useApp();
    const { navigate } = useRouter();

    // State
    const [pockets, setPockets] = useState<Pocket[]>([]);
    const [selectedPocket, setSelectedPocket] = useState<string>('');
    const [ligandFile, setLigandFile] = useState<File | null>(null);
    const [dockingId, setDockingId] = useState<string | null>(null);
    const [status, setStatus] = useState<string>('idle'); // idle, starting, running, completed, error
    const [result, setResult] = useState<DockingResult | null>(null);
    const [dockedMolecule, setDockedMolecule] = useState<MoleculeData | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);

    // Load initial data (pockets)
    useEffect(() => {
        if (jobId && pdbId) {
            apiClient.detectPockets(jobId, pdbId)
                .then(data => setPockets(data.pockets || []))
                .catch(err => console.error("Failed to load pockets", err));
        }
    }, [jobId, pdbId]);

    // Polling
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (dockingId && (status === 'starting' || status === 'running')) {
            interval = setInterval(async () => {
                try {
                    const res = await apiClient.getDockingResult(jobId!, dockingId);
                    if (res.status === 'done' || res.status === 'completed') {
                        setStatus('completed');
                        setResult(res);
                        clearInterval(interval);
                        loadDockedStructure(res.docking_id);
                    } else if (res.status === 'error' || res.status === 'failed') {
                        setStatus('error');
                        setResult(res);
                        clearInterval(interval);
                    } else {
                        setStatus('running');
                    }
                } catch (e) {
                    console.error(e);
                }
            }, 2000);
        }
        return () => clearInterval(interval);
    }, [dockingId, status, jobId]);

    const loadDockedStructure = async (dId: string) => {
        try {
            const data = await apiClient.getDockedMolecule(jobId!, dId);
            setDockedMolecule(data);
            setToast({ message: "Docked complex loaded", type: "success" });
        } catch (e) {
            console.error(e);
            setToast({ message: "Failed to load visualization", type: "error" });
        }
    };

    const handleStartDocking = async () => {
        if (!ligandFile || !jobId || !pdbId) return;

        setStatus('starting');
        try {
            const pocketData = pockets.find(p => p.pocket_id === selectedPocket);
            const res = await apiClient.startDocking(jobId, pdbId, ligandFile, pocketData);
            setDockingId(res.docking_id);
            setToast({ message: "Docking job started", type: "info" });
        } catch (e) {
            setStatus('error');
            setToast({ message: "Failed to start docking", type: "error" });
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <Header />

            <main className="flex-1 flex flex-col md:flex-row h-[calc(100vh-64px)] overflow-hidden">
                {/* Left Sidebar: Controls */}
                <div className="w-full md:w-96 bg-white border-r border-slate-200 flex flex-col h-full overflow-y-auto z-10 shadow-sm">
                    <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                        <button onClick={() => navigate(`/job/${jobId}`)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                            <ArrowLeft className="w-5 h-5 text-slate-500" />
                        </button>
                        <h2 className="font-bold text-slate-800">Docking Configuration</h2>
                    </div>

                    <div className="p-6 space-y-8">
                        {/* File Upload */}
                        <div className="space-y-3">
                            <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">1. Ligand</label>
                            <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-teal-500 transition-colors relative group">
                                <input
                                    type="file"
                                    accept=".sdf,.pdb,.mol2"
                                    onChange={(e) => setLigandFile(e.target.files?.[0] || null)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <div className="flex flex-col items-center gap-2 text-slate-400 group-hover:text-teal-600 transition-colors">
                                    <Upload className="w-8 h-8" />
                                    <span className="text-sm font-medium">{ligandFile ? ligandFile.name : "Upload Ligand File"}</span>
                                </div>
                            </div>
                        </div>

                        {/* Pocket Selection */}
                        <div className="space-y-3">
                            <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">2. Target Site</label>
                            <select
                                value={selectedPocket}
                                onChange={(e) => setSelectedPocket(e.target.value)}
                                className="w-full p-3 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                            >
                                <option value="">Whole Protein (Blind Docking)</option>
                                {pockets.map(p => (
                                    <option key={p.pocket_id} value={p.pocket_id}>Pocket {p.pocket_id} (Score: {p.score})</option>
                                ))}
                            </select>
                        </div>

                        {/* Action */}
                        <div className="pt-4">
                            <Button
                                onClick={handleStartDocking}
                                disabled={!ligandFile || status === 'starting' || status === 'running'}
                                className="w-full h-12 text-lg shadow-lg shadow-teal-500/20"
                            >
                                {status === 'running' || status === 'starting' ? (
                                    <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Processing...</>
                                ) : (
                                    <><Play className="w-5 h-5 mr-2" /> Start Docking</>
                                )}
                            </Button>
                        </div>

                        {/* Results Card */}
                        {(status === 'completed' || status === 'error') && result && (
                            <div className={`rounded-xl p-5 border ${status === 'completed' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                                <div className="flex items-center gap-3 mb-3">
                                    {status === 'completed' ? <CheckCircle className="w-6 h-6 text-emerald-600" /> : <AlertCircle className="w-6 h-6 text-red-600" />}
                                    <h3 className={`font-bold ${status === 'completed' ? 'text-emerald-900' : 'text-red-900'}`}>
                                        {status === 'completed' ? 'Docking Complete' : 'Docking Failed'}
                                    </h3>
                                </div>

                                {status === 'completed' && (
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-emerald-800 opacity-80">Best Affinity</span>
                                            <span className="font-mono font-bold text-emerald-700 text-lg">
                                                {result.best_energy?.toFixed(2) || "N/A"} <span className="text-xs font-normal">kcal/mol</span>
                                            </span>
                                        </div>
                                        <p className="text-xs text-emerald-700 mt-2">
                                            Visualization loaded. Receptors are shown in gray, ligand in selected colors.
                                        </p>
                                    </div>
                                )}

                                {status === 'error' && (
                                    <p className="text-sm text-red-800 break-words">
                                        {(result as any).error || "Unknown error occurred."}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Visualization */}
                <div className="flex-1 bg-slate-100 p-4 overflow-hidden relative">
                    {dockedMolecule ? (
                        <div className="h-full w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                            <div className="flex-1 relative">
                                {/* We reuse MoleculeViewer but force it to fill height if possible, or just default */}
                                <div className="absolute inset-0 overflow-y-auto p-4">
                                    <MoleculeViewer
                                        moleculeData={dockedMolecule}
                                        selectedAtomIndex={null}
                                        onAtomSelect={() => { }}
                                        renderMode='ball-and-stick'
                                        colorMode='element'
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                                <Play className="w-10 h-10 ml-1 opacity-50" />
                            </div>
                            <p className="text-lg font-medium">Ready to Dock</p>
                            <p className="text-sm opacity-70 max-w-xs text-center mt-2">
                                Configure the ligand and target pocket on the left to begin the simulation.
                            </p>
                        </div>
                    )}
                </div>
            </main>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}
