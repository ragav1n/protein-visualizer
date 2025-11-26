# attack.py
import os, json, math

def analyze_attack_site(jsonp, atom_index, partner_json=None, outdir=None):
    """
    Performs heuristic reactivity + geometry analysis between a reactive atom
    in molecule A and optionally molecule B.
    Errors are raised as ValueError for clean FastAPI handling.
    """

    # Make sure saved directory exists
    if outdir:
        os.makedirs(outdir, exist_ok=True)

    # --- Load main molecule JSON ---
    try:
        with open(jsonp) as f:
            mol = json.load(f)
    except FileNotFoundError:
        raise ValueError(f"Primary molecule JSON not found: {jsonp}")

    atoms = mol.get("atoms", [])
    if not atoms:
        raise ValueError("Primary molecule contains no atoms.")

    # --- Find chosen atom safely ---
    atom = next((a for a in atoms if a.get("index") == atom_index), None)
    if atom is None:
        raise ValueError(f"Atom index {atom_index} not found in primary molecule.")

    # --- Base reactivity analysis ---
    elem = atom.get("element", "").upper()
    report = {
        "atom": atom,
        "reactivity": "low",
        "geometry_ok": False,
        "notes": []
    }

    if elem in ("S", "O", "N"):
        report["reactivity"] = "possible"
        report["notes"].append(f"Element {elem} is often nucleophilic/electrophilic.")

    # --- If no partner molecule is provided, return single-molecule analysis ---
    if partner_json is None:
        if outdir:
            with open(os.path.join(outdir, "report.json"), "w") as f:
                json.dump(report, f, indent=2)
        return report

    # --- Load partner molecule ---
    try:
        with open(partner_json) as f:
            partner = json.load(f)
    except FileNotFoundError:
        raise ValueError(f"Partner molecule JSON not found: {partner_json}")

    p_atoms = partner.get("atoms", [])
    if not p_atoms:
        raise ValueError("Partner molecule contains no atoms.")

    # --- Compute minimum interatomic distance ---
    min_d = 999
    for b in p_atoms:
        dx = atom["x"] - b["x"]
        dy = atom["y"] - b["y"]
        dz = atom["z"] - b["z"]
        d = math.sqrt(dx*dx + dy*dy + dz*dz)
        if d < min_d:
            min_d = d

    report["min_distance_to_partner"] = round(min_d, 4)
    report["geometry_ok"] = min_d < 2.5

    if report["geometry_ok"]:
        report["notes"].append("Geometry is favorable (< 2.5 Å).")
    else:
        report["notes"].append("Geometry NOT favorable (> 2.5 Å).")

    # --- Save result ---
    if outdir:
        with open(os.path.join(outdir, "report.json"), "w") as f:
            json.dump(report, f, indent=2)

    return report
