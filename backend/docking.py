import os
import subprocess

# Backend Configuration - Binary Paths
# Using user-downloaded Vina and system Obabel
VINA_CMD = "/Users/ragav/Downloads/vina_1.2.7_mac_aarch64"
OBABEL_CMD = "/opt/homebrew/bin/obabel"

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
    subprocess.run([OBABEL_CMD, receptor_single, "-O", receptor_pdbqt, "-xr", "--partialcharge", "gasteiger"], check=True)

    # Step 3: convert ligand to PDBQT
    subprocess.run([OBABEL_CMD, ligand_file, "-O", ligand_pdbqt, "--gen3d", "--partialcharge", "gasteiger"], check=True)

    # Step 4: run Vina
    subprocess.run([
        VINA_CMD,
        "--receptor", receptor_pdbqt,
        "--ligand", ligand_pdbqt,
        "--center_x", str(center[0]),
        "--center_y", str(center[1]),
        "--center_z", str(center[2]),
        "--size_x", str(size[0]),
        "--size_y", str(size[1]),
        "--size_z", str(size[2]),
        "--out", out_pdbqt,
        "--exhaustiveness", "2"
    ], check=True)

    # Step 5: convert out.pdbqt -> out.pdb
    out_pdb = os.path.join(dock_dir, "out.pdb")
    try:
        subprocess.run([OBABEL_CMD, out_pdbqt, "-O", out_pdb], check=True)
    except Exception as e:
        print(f"Error converting output to PDB: {e}")

    # Step 6: parse scores from out.pdbqt
    best_energy = 0.0
    try:
        with open(out_pdbqt, "r") as f:
            for line in f:
                if "VINA RESULT:" in line: # Less strict check
                    parts = line.split()
                    # format: REMARK VINA RESULT:   -6.5      0.000      0.000
                    # parts might be ['REMARK', 'VINA', 'RESULT:', '-6.5', ...]
                    try:
                        # Find the number after RESULT:
                        idx = parts.index("RESULT:")
                        if idx + 1 < len(parts):
                            best_energy = float(parts[idx + 1])
                            print(f"[Docking] Found best energy: {best_energy}")
                            break
                    except ValueError:
                        continue
    except Exception as e:
        print(f"Error parsing scores: {e}")

    return {
        "output_pdbqt": out_pdbqt,
        "output_pdb": out_pdb if os.path.exists(out_pdb) else None,
        "best_energy": best_energy
    }