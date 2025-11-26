import { API_BASE_URL } from '../config';

export interface UploadResponse {
  job_id: string;
  pdb_id: string;
  message?: string;
}

export interface MoleculeData {
  atoms: Array<{
    atom_index: number;
    atom_name?: string;
    element?: string;
    residue_name?: string;
    residue_number?: number;
    chain_id?: string;
    b_factor?: number;
    x: number;
    y: number;
    z: number;
  }>;
  bonds?: Array<{
    a: number;
    b: number;
    dist?: number;
  }>;
  [key: string]: unknown;
}

export interface Pocket {
  pocket_id: string;
  score?: number;
  center?: { x: number; y: number; z: number };
  [key: string]: unknown;
}

export interface DockingResult {
  docking_id: string;
  status: string;
  poses?: Array<{
    pose_id: string;
    score: number;
    path?: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface RefinementResult {
  refinement_id: string;
  status: string;
  files?: string[];
  [key: string]: unknown;
}

export interface AttackResult {
  attack_id: string;
  status: string;
  report?: unknown;
  [key: string]: unknown;
}

export interface JobSummary {
  job_id: string;
  status: string;
  molecules: string[];
  created_at?: string;
}

export const apiClient = {
  async getJobs(): Promise<{ jobs: JobSummary[] }> {
    const response = await fetch(`${API_BASE_URL}/jobs`);

    if (!response.ok) {
      throw new Error(`Failed to fetch jobs: ${response.statusText}`);
    }

    return response.json();
  },

  async getJob(jobId: string): Promise<JobSummary> {
    const response = await fetch(`${API_BASE_URL}/job/${jobId}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch job: ${response.statusText}`);
    }

    return response.json();
  },

  async uploadPDB(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/upload_pdb`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return response.json();
  },

  async getMolecule(jobId: string, pdbId: string): Promise<MoleculeData> {
    const response = await fetch(`${API_BASE_URL}/job/${jobId}/molecule/${pdbId}`);

    if (!response.ok) {
      throw new Error(`Failed to load molecule: ${response.statusText}`);
    }

    return response.json();
  },

  async preprocess(jobId: string, pdbId: string): Promise<unknown> {
    const formData = new FormData();
    formData.append('pdb_id', pdbId);

    const response = await fetch(`${API_BASE_URL}/job/${jobId}/preprocess`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Preprocess failed: ${response.statusText}`);
    }

    return response.json();
  },

  async detectPockets(jobId: string, pdbId: string): Promise<{ pockets: Pocket[] }> {
    const formData = new FormData();
    formData.append('pdb_id', pdbId);

    const response = await fetch(`${API_BASE_URL}/job/${jobId}/detect_pockets`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Pocket detection failed: ${response.statusText}`);
    }

    return response.json();
  },

  async startDocking(
    jobId: string,
    receptorPdbId: string,
    ligandFile: File,
    pocketData?: unknown
  ): Promise<{ docking_id: string }> {
    const formData = new FormData();
    formData.append('receptor_pdb_id', receptorPdbId);
    formData.append('ligand_file', ligandFile);
    if (pocketData) {
      formData.append('pocket_data', JSON.stringify(pocketData));
    }

    const response = await fetch(`${API_BASE_URL}/job/${jobId}/start_docking`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Docking failed to start: ${response.statusText}`);
    }

    return response.json();
  },

  async getDockingResult(jobId: string, dockingId: string): Promise<DockingResult> {
    const response = await fetch(`${API_BASE_URL}/job/${jobId}/docking/${dockingId}/result`);

    if (!response.ok) {
      throw new Error(`Failed to get docking result: ${response.statusText}`);
    }

    return response.json();
  },

  async startRefinement(
    jobId: string,
    pdbId: string,
    poseFile: File | string
  ): Promise<{ refinement_id: string }> {
    const formData = new FormData();
    formData.append('pdb_id', pdbId);

    if (typeof poseFile === 'string') {
      formData.append('pose_file', poseFile);
    } else {
      formData.append('pose_file', poseFile);
    }

    const response = await fetch(`${API_BASE_URL}/job/${jobId}/start_refinement`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Refinement failed to start: ${response.statusText}`);
    }

    return response.json();
  },

  async getRefinementResult(jobId: string, refinementId: string): Promise<RefinementResult> {
    const response = await fetch(`${API_BASE_URL}/job/${jobId}/refinement/${refinementId}/result`);

    if (!response.ok) {
      throw new Error(`Failed to get refinement result: ${response.statusText}`);
    }

    return response.json();
  },

  async startFolding(jobId: string, sequence: string): Promise<{ folding_id: string }> {
    const formData = new FormData();
    formData.append('sequence', sequence);

    const response = await fetch(`${API_BASE_URL}/job/${jobId}/start_folding`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Folding failed to start: ${response.statusText}`);
    }

    return response.json();
  },

  async startAttack(jobId: string, pdbId: string, atomIndex: number): Promise<{ attack_id: string }> {
    const formData = new FormData();
    formData.append('pdb_id', pdbId);
    formData.append('atom_index', atomIndex.toString());

    const response = await fetch(`${API_BASE_URL}/job/${jobId}/attack`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Attack failed to start: ${response.statusText}`);
    }

    return response.json();
  },

  async getAttackResult(jobId: string, attackId: string): Promise<AttackResult> {
    const response = await fetch(`${API_BASE_URL}/job/${jobId}/attack/${attackId}/result`);

    if (!response.ok) {
      throw new Error(`Failed to get attack result: ${response.statusText}`);
    }

    return response.json();
  },

  async getRamachandranData(jobId: string, pdbId: string): Promise<{ data: Array<{ residue_name: string; residue_number: number; chain_id: string; phi: number; psi: number }> }> {
    const response = await fetch(`${API_BASE_URL}/job/${jobId}/analysis/ramachandran?pdb_id=${pdbId}`);
    if (!response.ok) throw new Error('Failed to fetch Ramachandran data');
    return response.json();
  },

  async getContactMapData(jobId: string, pdbId: string): Promise<{ data: Array<{ x: number; y: number; value: number; res_x: string; res_y: string }> }> {
    const response = await fetch(`${API_BASE_URL}/job/${jobId}/analysis/contact_map?pdb_id=${pdbId}`);
    if (!response.ok) throw new Error('Failed to fetch Contact Map data');
    return response.json();
  },

  async getSequenceData(jobId: string, pdbId: string): Promise<{ data: Array<{ residue_name: string; residue_number: number; chain_id: string; code: string }> }> {
    const response = await fetch(`${API_BASE_URL}/job/${jobId}/analysis/sequence?pdb_id=${pdbId}`);
    if (!response.ok) throw new Error('Failed to fetch Sequence data');
    return response.json();
  },
};
