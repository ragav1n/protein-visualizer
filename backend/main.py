import os, uuid, json, math, asyncio
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from pdb_utils import parse_pdb, infer_bonds, atoms_to_json, load_atoms_from_json, calculate_phi_psi, calculate_contact_map, get_sequence
from pocket import Scientific_Pockets
from docking import run_docking_job
from pocket import Scientific_Pockets
from docking import run_docking_job

BASE = "backend_jobs"
JOBS_FILE = os.path.join(BASE, "jobs.json")
JOBS = {}

os.makedirs(BASE, exist_ok=True)

def save_jobs():
    """Save JOBS to disk."""
    try:
        with open(JOBS_FILE, "w") as f:
            json.dump(JOBS, f, indent=2)
    except Exception as e:
        print(f"Error saving jobs: {e}")

def load_jobs():
    """Load JOBS from disk."""
    global JOBS
    if os.path.exists(JOBS_FILE):
        try:
            with open(JOBS_FILE, "r") as f:
                JOBS = json.load(f)
            print(f"Loaded {len(JOBS)} jobs from disk.")
        except Exception as e:
            print(f"Error loading jobs: {e}")

# Load jobs on startup
load_jobs()

app = FastAPI(title="Proteins-EL Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Utility: create job folder
def _make_job():
    job_id = uuid.uuid4().hex[:8]
    job_dir = os.path.join(BASE, job_id)
    os.makedirs(job_dir, exist_ok=True)
    JOBS[job_id] = {"status": "created", "dir": job_dir}
    save_jobs()
    return job_id, job_dir


@app.get("/jobs")
def list_jobs():
    """List all jobs in memory."""
    job_list = []
    for jid, data in JOBS.items():
        # Extract molecule IDs if available
        molecules = list(data.get("molecules", {}).keys())
        job_list.append({
            "job_id": jid,
            "status": data.get("status", "unknown"),
            "molecules": molecules,
            "created_at": "Just now" # Placeholder, could add timestamp
        })
    return {"jobs": job_list}


@app.get("/job/{job_id}")
def get_job(job_id: str):
    """Get details for a specific job."""
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    
    molecules = list(job.get("molecules", {}).keys())
    return {
        "job_id": job_id,
        "status": job.get("status", "unknown"),
        "molecules": molecules,
        "created_at": "Just now"
    }


# ---------------------------
# Phase 1: Upload / Load PDB
# ---------------------------
@app.post("/upload_pdb")
async def upload_pdb(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdb"):
        raise HTTPException(400, "File must be .pdb")

    job_id, job_dir = _make_job()

    pdb_id = os.path.splitext(file.filename)[0]
    pdb_path = os.path.join(job_dir, file.filename)

    with open(pdb_path, "wb") as f:
        f.write(await file.read())

    atoms = parse_pdb(pdb_path)
    bonds = infer_bonds(atoms)
    mol_json = atoms_to_json(pdb_id, atoms, bonds)
    json_path = os.path.join(job_dir, f"{pdb_id}.json")

    with open(json_path, "w") as jf:
        json.dump(mol_json, jf, indent=2)

    JOBS[job_id] = {
        "status": "ready",
        "dir": job_dir,
        "molecules": {pdb_id: json_path}
    }
    save_jobs()

    return {
        "job_id": job_id,
        "pdb_id": pdb_id,
        "molecule_json": f"/job/{job_id}/molecule/{pdb_id}"
    }


@app.get("/job/{job_id}/molecule/{pdb_id}")
def get_molecule(job_id: str, pdb_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    path = os.path.join(job["dir"], f"{pdb_id}.json")
    if not os.path.exists(path):
        raise HTTPException(404, "Molecule not found")

    return FileResponse(path)


# ---------------------------
# Phase 2: Preprocessing
# ---------------------------
@app.post("/job/{job_id}/preprocess")
def preprocess(
    job_id: str,
    pdb_id: str = Form(...)
):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    json_path = os.path.join(job["dir"], f"{pdb_id}.json")

    if not os.path.exists(json_path):
        raise HTTPException(404, "Molecule not found")

    with open(json_path) as f:
        mol = json.load(f)

    mol.setdefault("metadata", {})["preprocessed"] = True

    with open(json_path, "w") as f:
        json.dump(mol, f, indent=2)
    
    # Update job status/metadata if needed and save
    save_jobs()

    return {"status": "preprocessed", "pdb_id": pdb_id}


# ---------------------------
# Phase 3: Pocket Detection
# ---------------------------
@app.post("/job/{job_id}/detect_pockets")
def detect(job_id: str, pdb_id: str = Form(...)):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    json_path = os.path.join(job["dir"], f"{pdb_id}.json")

    if not os.path.exists(json_path):
        raise HTTPException(404, "Molecule JSON not found")

    with open(json_path) as f:
        mol = json.load(f)

    # --- Validate atom fields for Scientific_Pockets() ---
    cleaned_atoms = []
    for atom in mol.get("atoms", []):
        cleaned_atoms.append({
            "x": float(atom.get("x", 0)),
            "y": float(atom.get("y", 0)),
            "z": float(atom.get("z", 0)),
            "chain": atom.get("chain", "_"),
            "resseq": int(atom.get("resseq", 0)),
            "resname": atom.get("resname", "UNK"),
        })

    mol["atoms"] = cleaned_atoms

    # --- Run scientific pocket detection ---
    try:
        result = Scientific_Pockets(mol)
    except Exception as e:
        raise HTTPException(500, f"Pocket detection failed: {str(e)}")

    # Save result
    out = os.path.join(job["dir"], f"{pdb_id}.pockets.json")
    with open(out, "w") as f:
        json.dump(result, f, indent=2)

    save_jobs()
    return result

# ---------------------------
# Phase 4: Bond Energy LJ
# ---------------------------
@app.get("/bond_energy")
def bond_energy(job_id: str, pdb_id: str, a_idx: int, b_idx: int):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    json_path = os.path.join(job["dir"], f"{pdb_id}.json")
    atoms = load_atoms_from_json(json_path)

    A = next((x for x in atoms if x["index"] == a_idx), None)
    B = next((x for x in atoms if x["index"] == b_idx), None)

    if not A or not B:
        raise HTTPException(404, "Atom not found")

    dx = A["x"] - B["x"]
    dy = A["y"] - B["y"]
    dz = A["z"] - B["z"]

    r = math.sqrt(dx*dx + dy*dy + dz*dz)
    inv = 1 / max(r, 1e-6)

    lj = 4 * ((inv**12) - (inv**6))
    feasible = r < 1.9

    return {
        "distance": round(r, 4),
        "estimated_energy": round(lj, 6),
        "feasible": feasible
    }


# ---------------------------
# Phase 5: Docking
# ---------------------------
@app.post("/job/{job_id}/start_docking")
async def start_docking(
    job_id: str,
    receptor_pdb_id: str = Form(...),
    ligand_file: UploadFile = File(...),
    pocket_data: str = Form(None)
):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    job_dir = job["dir"]

    receptor_pdb = os.path.join(job_dir, f"{receptor_pdb_id}.pdb")
    if not os.path.exists(receptor_pdb):
        raise HTTPException(404, f"Receptor PDB not found: {receptor_pdb}")

    ligand_path = os.path.join(job_dir, ligand_file.filename)
    with open(ligand_path, "wb") as f:
        f.write(await ligand_file.read())

    dock_id = uuid.uuid4().hex[:8]
    dock_dir = os.path.join(job_dir, "docking", dock_id)
    os.makedirs(dock_dir, exist_ok=True)

    async def run():
        try:
            # Parse pocket data if available
            center = (10, 20, 15) # Default center
            size = (20, 20, 20)   # Default size

            if pocket_data:
                try:
                    p = json.loads(pocket_data)
                    if "center" in p:
                        c = p["center"]
                        center = (c[0], c[1], c[2])
                    
                    # Heuristic for size based on volume or default to slightly larger for known pocket
                    # If volume is available, approximate cube side
                    if "volume" in p:
                        vol = float(p["volume"])
                        side = (vol ** (1.3)) + 12.0 # Buffer
                        side = min(max(side, 18.0), 30.0) # Clamp between 18 and 30
                        size = (side, side, side)
                    else:
                        size = (22, 22, 22)
                except Exception as e:
                    print(f"Error parsing pocket data: {e}")

            result = run_docking_job(receptor_pdb, ligand_path, dock_dir, center=center, size=size)
            
            # Save result to file for endpoint to pick up
            result_data = {
                "docking_id": dock_id,
                "status": "done",
                **result
            }
            with open(os.path.join(dock_dir, "result.json"), "w") as f:
                json.dump(result_data, f, indent=2)

            job.setdefault("docking", {})[dock_id] = {
                "status": "done",
                "result": result
            }
            save_jobs()
        except Exception as e:
            error_data = {
                "docking_id": dock_id,
                "status": "error",
                "error": str(e)
            }
            with open(os.path.join(dock_dir, "result.json"), "w") as f:
                json.dump(error_data, f, indent=2)

            job.setdefault("docking", {})[dock_id] = {
                "status": "error",
                "error": str(e)
            }
            save_jobs()

    asyncio.create_task(run())

    return {"status": "queued", "docking_id": dock_id}


@app.get("/job/{job_id}/docking/{dock_id}/result")
def docking_result(job_id: str, dock_id: str):
    job = JOBS.get(job_id)

    path = os.path.join(job["dir"], "docking", dock_id, "result.json")
    if not os.path.exists(path):
        raise HTTPException(404, "Result not ready")

    return FileResponse(path)


@app.get("/job/{job_id}/docking/{docking_id}/molecule")
def docking_molecule(job_id: str, docking_id: str):
    job = JOBS.get(job_id)
    if not job:
         raise HTTPException(404, "Job not found")

    dock_dir = os.path.join(job["dir"], "docking", docking_id)
    out_pdb = os.path.join(dock_dir, "out.pdb")

    # Try to find the specific PDB file for this job
    # We uploaded it as {pdb_id}.pdb
    files = [f for f in os.listdir(job["dir"]) if f.endswith(".pdb") and "out.pdb" not in f and "receptor" not in f]
    receptor_path = None
    
    # Heuristic: try finding the exact pdb_id file first
    expected_pdb = os.path.join(job["dir"], f"{job.get('pdb_id', '')}.pdb")
    if os.path.exists(expected_pdb):
        receptor_path = expected_pdb
    elif files:
        receptor_path = os.path.join(job["dir"], files[0])
    
    if not os.path.exists(out_pdb):
        raise HTTPException(404, "Docking output not found")
        
    try:
        # Parse ligand (docking output)
        ligand_atoms_all = parse_pdb(out_pdb)
        
        # Filter for just the first model (assuming parse_pdb returns all models sequentially)
        # We can detect model breaks if residue numbers reset or similar, but for now, 
        # let's just take the first N atoms where N is atoms per model?
        # A safer way with the current parse_pdb (which flattens everything) is tricky.
        # But actually, showing *all* poses is kind of cool? Let's keep all poses for now.
        # Or, just show the best pose (first one).
        # Typically the first X atoms correspond to the first model.
        # Let's count atoms in first model from the file content to be safe?
        # For simplicity, let's just use all of them, but separate them visually?
        # No, that will look messy.
        # Let's try to infer if there are duplicates.
        
        ligand_atoms = ligand_atoms_all
        # If we have receptor, merge
        combined_atoms = []
        combined_bonds = []
        
        if receptor_path:
            try:
                print(f"[DockingMolecule] Loading receptor from {receptor_path}")
                receptor_atoms = parse_pdb(receptor_path)
                combined_atoms.extend(receptor_atoms)
                
                # Infer bonds for receptor
                receptor_bonds = infer_bonds(receptor_atoms)
                combined_bonds.extend(receptor_bonds)

                offset = len(combined_atoms) # Offset is current length (receptor count)
                
                # Taking ONLY the first model of ligand if possible. 
                # If ligand_atoms_all has multiple models, they satisfy: same atom names repeated.
                # Let's just take the first occurrence of atoms?
                # Simple heuristic: Identify by atom index. in PDBQT, indices reset or continue?
                # In the out.pdb, atoms are numbered 1..N for each MODEL.
                # parse_pdb re-indexes them 1..Total?
                # Let's check parse_pdb implementation in mind... it increments i=1.
                # So we just get a long list. 
                # Let's just slice the first model?
                # How many atoms in one model?
                # Logic: The ligand usually doesn't change atom count.
                # We can check if atom index 1 appears multiple times?
                # parse_pdb assigns its own index.
                # Let's check if 'resseq' resets? no.
                # Let's just SHOW ALL poses for now, as the user might want to see the cluster.
                
                for atom in ligand_atoms:
                    new_atom = atom.copy()
                    new_atom["index"] = offset + atom["index"] # Shift index to be unique
                    new_atom["chain"] = "L" # Force ligand chain
                    combined_atoms.append(new_atom)
                
                # Bonds for ligand
                ligand_bonds = infer_bonds(ligand_atoms)
                for b in ligand_bonds:
                    combined_bonds.append({
                        "a": b["a"] + offset,
                        "b": b["b"] + offset,
                        "dist": b["dist"]
                    })
            except Exception as e:
                print(f"Error merging receptor: {e}")
                # Fallback to just ligand
                combined_atoms = ligand_atoms
                combined_bonds = infer_bonds(ligand_atoms)
        else:
             combined_atoms = ligand_atoms
             combined_bonds = infer_bonds(ligand_atoms)

        return {
            "atoms": combined_atoms,
            "bonds": combined_bonds
        }
    except Exception as e:
        print(f"Error parsing docked structure: {e}")
        raise HTTPException(500, f"Failed to parse docked structure: {e}")


# ---------------------------
# Phase 6: Analysis
# ---------------------------

@app.get("/job/{job_id}/analysis/ramachandran")
def ramachandran(job_id: str, pdb_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    # We need the original PDB file for Bio.PDB analysis
    # The PDB file is stored as {pdb_id}.pdb in the job directory
    pdb_path = os.path.join(job["dir"], f"{pdb_id}.pdb")
    
    # If not found (maybe uploaded with different name), try to find any .pdb
    if not os.path.exists(pdb_path):
        # Fallback: check if we saved the original filename mapping or just look for .pdb files
        # In upload_pdb we saved it as file.filename. 
        # But we also have {pdb_id}.json.
        # Let's assume standard naming or find the first .pdb
        files = [f for f in os.listdir(job["dir"]) if f.endswith(".pdb")]
        if not files:
             raise HTTPException(404, "PDB file not found for analysis")
        pdb_path = os.path.join(job["dir"], files[0])

    try:
        data = calculate_phi_psi(pdb_path)
        return {"data": data}
    except Exception as e:
        raise HTTPException(500, f"Analysis failed: {str(e)}")


@app.get("/job/{job_id}/analysis/contact_map")
def contact_map(job_id: str, pdb_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    pdb_path = os.path.join(job["dir"], f"{pdb_id}.pdb")
    if not os.path.exists(pdb_path):
        files = [f for f in os.listdir(job["dir"]) if f.endswith(".pdb")]
        if not files:
             raise HTTPException(404, "PDB file not found for analysis")
        pdb_path = os.path.join(job["dir"], files[0])

    try:
        data = calculate_contact_map(pdb_path)
        return {"data": data}
    except Exception as e:
        raise HTTPException(500, f"Analysis failed: {str(e)}")


@app.get("/job/{job_id}/analysis/sequence")
def sequence(job_id: str, pdb_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    pdb_path = os.path.join(job["dir"], f"{pdb_id}.pdb")
    if not os.path.exists(pdb_path):
        files = [f for f in os.listdir(job["dir"]) if f.endswith(".pdb")]
        if not files:
             raise HTTPException(404, "PDB file not found for analysis")
        pdb_path = os.path.join(job["dir"], files[0])

    try:
        data = get_sequence(pdb_path)
        return {"data": data}
    except Exception as e:
        raise HTTPException(500, f"Analysis failed: {str(e)}")