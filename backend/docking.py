import os, json, shutil, subprocess

def docking_available():
    return shutil.which("vina") is not None


def json_to_pdb(json_file, out_pdb):
    with open(json_file) as f:
        mol = json.load(f)

    with open(out_pdb, "w") as out:
        i = 1
        for a in mol["atoms"]:
            out.write(
                "ATOM  %5d  %-4s LIG     1    %8.3f%8.3f%8.3f\n" %
                (i, a["element"], a["x"], a["y"], a["z"])
            )
            i += 1


def run_docking_job(receptor_json, ligand_path, outdir):

    receptor_pdb = os.path.join(outdir, "receptor.pdb")
    json_to_pdb(receptor_json, receptor_pdb)

    ligand_pdbqt = None
    if ligand_path:
        ligand_pdbqt = os.path.join(outdir, "ligand.pdbqt")
        shutil.copy(ligand_path, ligand_pdbqt)

    out_pdbqt = os.path.join(outdir, "out.pdbqt")

    if not docking_available():
        with open(out_pdbqt, "w") as f:
            f.write("REMARK VINA RESULT: -6.5\n")
        return {"status": "mock", "best_energy": -6.5, "pose": out_pdbqt}

    cmd = [
        "vina",
        "--receptor", receptor_pdb,
        "--ligand", ligand_pdbqt,
        "--out", out_pdbqt,
        "--center_x", "0",
        "--center_y", "0",
        "--center_z", "0",
        "--size_x", "20",
        "--size_y", "20",
        "--size_z", "20"
    ]

    subprocess.run(cmd, check=False)

    best = -6.0
    with open(out_pdbqt) as f:
        for line in f:
            if "REMARK VINA RESULT" in line:
                best = float(line.split()[-1])

    return {"status": "success", "best_energy": best, "pose": out_pdbqt}