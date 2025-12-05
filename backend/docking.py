import os
import subprocess

def keep_first_model(input_pdb: str, output_pdb: str):
    with open(input_pdb, "r") as f:
        lines = f.readlines()
    output_lines = []
    in_model = False
    for line in lines:
        if line.startswith("MODEL"):
            if in_model:
                break
            in_model = True
        if in_model or not line.startswith("MODEL"):
            output_lines.append(line)
        if line.startswith("ENDMDL") and in_model:
            break
    with open(output_pdb, "w") as f:
        f.writelines(output_lines)

def run_docking_job(receptor_pdb: str, ligand_file: str, dock_dir: str,
                    center=(10,20,15), size=(20,20,20)):
    """
    Prepare receptor/ligand and run AutoDock Vina.
    Returns output path and optionally parses docking scores.
    """
    receptor_single = os.path.join(dock_dir, "receptor_single.pdb")
    receptor_pdbqt = os.path.join(dock_dir, "receptor.pdbqt")
    ligand_pdbqt = os.path.join(dock_dir, "ligand.pdbqt")
    out_pdbqt = os.path.join(dock_dir, "out.pdbqt")

    # Step 1: keep only first model
    keep_first_model(receptor_pdb, receptor_single)

    # Step 2: convert receptor to PDBQT
    subprocess.run(["obabel", receptor_single, "-O", receptor_pdbqt, "-xr"], check=True)

    # Step 3: convert ligand to PDBQT
    subprocess.run(["obabel", ligand_file, "-O", ligand_pdbqt, "--gen3d"], check=True)

    # Step 4: run Vina
    subprocess.run([
        "vina",
        "--receptor", receptor_pdbqt,
        "--ligand", ligand_pdbqt,
        "--center_x", str(center[0]),
        "--center_y", str(center[1]),
        "--center_z", str(center[2]),
        "--size_x", str(size[0]),
        "--size_y", str(size[1]),
        "--size_z", str(size[2]),
        "--out", out_pdbqt,
        "--exhaustiveness", "8"
    ], check=True)

    return {"output_pdbqt": out_pdbqt}