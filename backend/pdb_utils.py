import math
import numpy as np
from Bio.PDB import PDBParser, PPBuilder

three_to_one = {
    'ALA': 'A', 'CYS': 'C', 'ASP': 'D', 'GLU': 'E',
    'PHE': 'F', 'GLY': 'G', 'HIS': 'H', 'ILE': 'I',
    'LYS': 'K', 'LEU': 'L', 'MET': 'M', 'ASN': 'N',
    'PRO': 'P', 'GLN': 'Q', 'ARG': 'R', 'SER': 'S',
    'THR': 'T', 'VAL': 'V', 'TRP': 'W', 'TYR': 'Y'
}

def parse_pdb(path):
    parser = PDBParser(QUIET=True)
    structure = parser.get_structure("prot", path)

    atoms = []
    i = 1

    for model in structure:
        for chain in model:
            for residue in chain:
                res_name = residue.get_resname()
                res_num = residue.get_id()[1]
                
                for atom in residue:
                    element = atom.element if atom.element else atom.get_name()[0]
                    atoms.append({
                        "index": i,
                        "element": element,
                        "name": atom.get_name(),
                        "residue_name": res_name,
                        "residue_number": res_num,
                        "chain_id": chain.get_id(),
                        "b_factor": atom.get_bfactor(),
                        "x": float(atom.coord[0]),
                        "y": float(atom.coord[1]),
                        "z": float(atom.coord[2])
                    })
                    i += 1

    return atoms


def infer_bonds(atoms, threshold=1.9):
    bonds = []
    # Optimization: Only check atoms within reasonable index range or use spatial hash
    # For now, simple optimization: only check atoms in same or adjacent residues
    
    # Pre-group by residue
    residues = {}
    for a in atoms:
        key = (a["chain_id"], a["residue_number"])
        if key not in residues:
            residues[key] = []
        residues[key].append(a)
        
    sorted_keys = sorted(residues.keys(), key=lambda x: (x[0], x[1]))
    
    for idx, key in enumerate(sorted_keys):
        # Check within residue
        curr_atoms = residues[key]
        for i in range(len(curr_atoms)):
            for j in range(i + 1, len(curr_atoms)):
                a = curr_atoms[i]
                b = curr_atoms[j]
                dist = math.sqrt((a["x"]-b["x"])**2 + (a["y"]-b["y"])**2 + (a["z"]-b["z"])**2)
                if dist < threshold:
                    bonds.append({"a": a["index"], "b": b["index"], "dist": dist})
        
        # Check with next residue (peptide bond)
        if idx < len(sorted_keys) - 1:
            next_key = sorted_keys[idx+1]
            # Only if same chain and sequential
            if key[0] == next_key[0] and next_key[1] == key[1] + 1:
                next_atoms = residues[next_key]
                # Usually C of curr connects to N of next
                c_atom = next((x for x in curr_atoms if x["name"] == "C"), None)
                n_atom = next((x for x in next_atoms if x["name"] == "N"), None)
                if c_atom and n_atom:
                    dist = math.sqrt((c_atom["x"]-n_atom["x"])**2 + (c_atom["y"]-n_atom["y"])**2 + (c_atom["z"]-n_atom["z"])**2)
                    if dist < 2.0: # Peptide bond is approx 1.33A
                         bonds.append({"a": c_atom["index"], "b": n_atom["index"], "dist": dist})

    return bonds


def atoms_to_json(pdb_id, atoms, bonds, metadata=None):
    return {
        "pdb_id": pdb_id,
        "atoms": atoms,
        "bonds": bonds,
        "metadata": metadata or {}
    }


def load_atoms_from_json(path):
    import json
    with open(path) as f:
        return json.load(f)["atoms"]


def calculate_phi_psi(path):
    parser = PDBParser(QUIET=True)
    structure = parser.get_structure("prot", path)
    ppb = PPBuilder()
    
    phi_psi_data = []
    
    for pp in ppb.build_peptides(structure):
        phi_psi = pp.get_phi_psi_list()
        for i, (phi, psi) in enumerate(phi_psi):
            res = pp[i]
            phi_deg = math.degrees(phi) if phi is not None else None
            psi_deg = math.degrees(psi) if psi is not None else None
            
            if phi_deg is not None and psi_deg is not None:
                phi_psi_data.append({
                    "residue_name": res.get_resname(),
                    "residue_number": res.get_id()[1],
                    "chain_id": res.get_parent().get_id(),
                    "phi": phi_deg,
                    "psi": psi_deg
                })
                
    return phi_psi_data


def calculate_contact_map(path):
    parser = PDBParser(QUIET=True)
    structure = parser.get_structure("prot", path)
    
    residues = list(structure.get_residues())
    n = len(residues)
    
    # Better format for frontend heatmap: list of {x: res_num, y: res_num, value: dist}
    data = []
    for i, r1 in enumerate(residues):
        if "CA" not in r1: continue
        for j, r2 in enumerate(residues):
            if i >= j: continue # Symmetric
            if "CA" not in r2: continue
            
            dist = r1["CA"] - r2["CA"]
            if dist < 12.0: # Cutoff for contact map visualization
                data.append({
                    "x": r1.get_id()[1],
                    "y": r2.get_id()[1],
                    "value": round(dist, 2),
                    "res_x": r1.get_resname(),
                    "res_y": r2.get_resname()
                })
                
    return data


def get_sequence(path):
    parser = PDBParser(QUIET=True)
    structure = parser.get_structure("prot", path)
    ppb = PPBuilder()
    
    seq_data = []
    for pp in ppb.build_peptides(structure):
        # Map back to residues
        for i, res in enumerate(pp):
            seq_data.append({
                "residue_name": res.get_resname(),
                "residue_number": res.get_id()[1],
                "chain_id": res.get_parent().get_id(),
                "code": three_to_one.get(res.get_resname(), 'X')
            })
            
    return seq_data