import os, uuid, json, math, asyncio
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from pdb_utils import parse_pdb, infer_bonds, atoms_to_json, load_atoms_from_json, calculate_phi_psi, calculate_contact_map, get_sequence
from pocket import detect_pockets
from docking import run_docking_job
from refinement import run_refinement_job
from folding import submit_folding_job
from attack import analyze_attack_site
from sequence_validator import validate_protein_sequence

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

    with open(json_path) as f:
        mol = json.load(f)

    pockets = detect_pockets(mol)

    out = os.path.join(job["dir"], f"{pdb_id}.pockets.json")
    with open(out, "w") as f:
        json.dump({"pockets": pockets}, f, indent=2)
    
    # Save jobs just in case we track pockets in JOBS later
    save_jobs()

    return {"pockets": pockets}


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
    ligand_file: UploadFile = File(None)
):
    job = JOBS.get(job_id)
    job_dir = job["dir"]

    receptor_json = os.path.join(job_dir, f"{receptor_pdb_id}.json")

    ligand_path = None
    if ligand_file:
        ligand_path = os.path.join(job_dir, ligand_file.filename)
        with open(ligand_path, "wb") as f:
            f.write(await ligand_file.read())

    dock_id = uuid.uuid4().hex[:8]
    dock_dir = os.path.join(job_dir, "docking", dock_id)
    os.makedirs(dock_dir, exist_ok=True)

    async def run():
        result = run_docking_job(receptor_json, ligand_path, dock_dir)
        with open(os.path.join(dock_dir, "result.json"), "w") as f:
            json.dump(result, f, indent=2)

        JOBS[job_id].setdefault("docking", {})[dock_id] = {
            "status": "done",
            "result": result
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


# ---------------------------
# Phase 6: Refinement
# ---------------------------
@app.post("/job/{job_id}/start_refinement")
def start_refinement(
    job_id: str,
    pdb_id: str = Form(...),
    pose_file: str = Form(...)
):
    job = JOBS.get(job_id)
    job_dir = job["dir"]

    ref_id = uuid.uuid4().hex[:8]
    ref_dir = os.path.join(job_dir, "refinement", ref_id)
    os.makedirs(ref_dir)

    result = run_refinement_job(pdb_id, pose_file, ref_dir)

    with open(os.path.join(ref_dir, "result.json"), "w") as f:
        json.dump(result, f, indent=2)

    save_jobs() # Assuming we might want to track this in JOBS later, but good practice

    return {"refinement_id": ref_id, "status": "done"}


@app.get("/job/{job_id}/refinement/{ref_id}/result")
def refinement_result(job_id: str, ref_id: str):
    job = JOBS.get(job_id)

    path = os.path.join(job["dir"], "refinement", ref_id, "result.json")
    if not os.path.exists(path):
        raise HTTPException(404, "Result not ready")

    return FileResponse(path)


# ---------------------------
# Phase 7: Folding (Mock)
# ---------------------------

@app.post("/job/{job_id}/start_folding")
def folding(job_id: str, sequence: str = Form(...)):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    job_dir = job["dir"]

    # Validate sequence
    try:
        clean_seq = validate_protein_sequence(sequence)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    fold_id = uuid.uuid4().hex[:8]
    fold_dir = os.path.join(job_dir, "folding", fold_id)
    os.makedirs(fold_dir, exist_ok=True)

    # Run mock folding job (can replace with real ESMFold later)
    result = submit_folding_job(clean_seq, fold_dir)

    with open(os.path.join(fold_dir, "result.json"), "w") as f:
        json.dump(result, f, indent=2)
    
    save_jobs()

    return {
        "fold_id": fold_id,
        "sequence_length": len(clean_seq),
        "status": "validated and folded (mock)",
        "result": result
    }


# ---------------------------
# Phase 8: Covalent Attack Analysis
# ---------------------------

@app.post("/job/{job_id}/attack")
def attack(
    job_id: str,
    pdb_id: str = Form(...),
    atom_index: int = Form(...),
    partner_job_id: str = Form(None),
    partner_pdb_id: str = Form(None)
):
    # ----------------------
    # Validate primary job
    # ----------------------
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "Primary job not found.")

    # Primary molecule path
    mol_json = os.path.join(job["dir"], f"{pdb_id}.json")
    if not os.path.exists(mol_json):
        raise HTTPException(404, f"Molecule '{pdb_id}' not found in job {job_id}.")

    # ----------------------
    # Check partner molecule if provided
    # ----------------------
    partner_json = None
    if partner_job_id and partner_pdb_id:
        if partner_job_id not in JOBS:
            raise HTTPException(404, "Partner job does not exist.")

        pjob = JOBS[partner_job_id]
        partner_json = os.path.join(pjob["dir"], f"{partner_pdb_id}.json")

        if not os.path.exists(partner_json):
            raise HTTPException(404, f"Partner molecule '{partner_pdb_id}' not found.")

    # ----------------------
    # Prepare output dir
    # ----------------------
    attack_id = uuid.uuid4().hex[:8]
    attack_dir = os.path.join(job["dir"], "attack", attack_id)
    os.makedirs(attack_dir, exist_ok=True)

    # ----------------------
    # Run reactivity analysis
    # ----------------------
    try:
        result = analyze_attack_site(
            mol_json,
            atom_index,
            partner_json,
            attack_dir
        )
    except ValueError as e:
        raise HTTPException(400, str(e))  # Clean user error
    except Exception as e:
        raise HTTPException(500, "Internal error: " + str(e))  # Unexpected

    # Save to job memory
    JOBS[job_id].setdefault("attacks", {})[attack_id] = {
        "status": "done",
        "result": result
    }
    save_jobs()

    return {
        "attack_id": attack_id,
        "status": "done",
        "result": result
    }


@app.get("/job/{job_id}/attack/{attack_id}/result")
def attack_result(job_id: str, attack_id: str):
    job = JOBS.get(job_id)

    path = os.path.join(job["dir"], "attack", attack_id, "report.json")
    if not os.path.exists(path):
        raise HTTPException(404, "Result not ready")

    return FileResponse(path)


# ---------------------------
# Phase 9: Analysis
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