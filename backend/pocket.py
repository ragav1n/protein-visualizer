import os, math
import numpy as np
from scipy.spatial import Delaunay, cKDTree
from collections import defaultdict

# --- HYDROPHOBICITY SCALE (Kyte–Doolittle) ---
KD = {
    'A':1.8,'R':-4.5,'N':-3.5,'D':-3.5,'C':2.5,
    'Q':-3.5,'E':-3.5,'G':-0.4,'H':-3.2,'I':4.5,
    'L':3.8,'K':-3.9,'M':1.9,'F':2.8,'P':-1.6,
    'S':-0.8,'T':-0.7,'W':-0.9,'Y':-1.3,'V':4.2
}

# convert 3-letter to 1-letter amino acid
AA3 = {
    'ALA':'A','ARG':'R','ASN':'N','ASP':'D','CYS':'C',
    'GLN':'Q','GLU':'E','GLY':'G','HIS':'H','ILE':'I',
    'LEU':'L','LYS':'K','MET':'M','PHE':'F','PRO':'P',
    'SER':'S','THR':'T','TRP':'W','TYR':'Y','VAL':'V'
}

# ---------------------- PDB PARSER ----------------------
def load_atoms(obj):
    """Accepts mol['atoms'] OR a PDB file path."""
    if isinstance(obj, str) and obj.lower().endswith(".pdb"):
        atoms = []
        residues = defaultdict(list)
        with open(obj) as f:
            for line in f:
                if line.startswith(("ATOM  ","HETATM")):
                    x=float(line[30:38]); y=float(line[38:46]); z=float(line[46:54])
                    res=line[17:20].strip()
                    chain=line[21].strip() or "_"
                    num=int(line[22:26])
                    idx=len(atoms)
                    atoms.append({
                        "x":x,"y":y,"z":z,
                        "resname":res,"chain":chain,"resseq":num
                    })
                    residues[(chain,num,res)].append(idx)
        return atoms, residues

    # assume mol["atoms"]
    atoms = obj["atoms"]
    residues = defaultdict(list)
    for i,a in enumerate(atoms):
        key = (a["chain"], a["resseq"], a["resname"])
        residues[key].append(i)
    return atoms, residues

# -------------------- ALPHA-SPHERE CALC --------------------
def circumsphere(p):
    p0=p[0]
    A=2*(p[1:]-p0)
    b=np.sum(p[1:]**2 - p0**2, axis=1)
    try:
        c=np.linalg.solve(A,b)
        r=np.linalg.norm(c-p0)
        return c,r
    except:
        return None,None

# ----------------------- CLUSTERING ------------------------
def cluster(points, eps=4.0, min_pts=5):
    if len(points)==0: return np.array([])
    tree = cKDTree(points)
    labels = -1*np.ones(len(points),dtype=int)
    cid=0
    for i in range(len(points)):
        if labels[i]!=-1: continue
        nbrs = tree.query_ball_point(points[i], eps)
        if len(nbrs) < min_pts:
            labels[i] = -1
            continue
        stack=set(nbrs)
        labels[i]=cid
        while stack:
            j=stack.pop()
            if labels[j]!=-1: continue
            labels[j]=cid
            new = tree.query_ball_point(points[j], eps)
            if len(new)>=min_pts:
                stack.update(new)
        cid+=1
    return labels

# ----------------------- VOLUME (ACCURATE) -----------------------
def voxel_volume(centers, radii, resolution=0.75):
    """Accurate pocket volume using voxelization."""
    if len(centers)==0:
        return 0.0
    centers=np.array(centers)
    minp=centers.min(axis=0)-radii.max()-1
    maxp=centers.max(axis=0)+radii.max()+1

    xs=np.arange(minp[0],maxp[0],resolution)
    ys=np.arange(minp[1],maxp[1],resolution)
    zs=np.arange(minp[2],maxp[2],resolution)

    X,Y,Z=np.meshgrid(xs,ys,zs,indexing="ij")
    pts=np.vstack([X.ravel(),Y.ravel(),Z.ravel()]).T

    vol=0
    tree = cKDTree(centers)
    for pt in pts:
        idxs = tree.query_ball_point(pt, radii.max())
        for i in idxs:
            if np.linalg.norm(pt-centers[i]) <= radii[i]:
                vol += resolution**3
                break
    return vol

# ---------------------- MAIN FUNCTION ----------------------
def Scientific_Pockets(mol_or_pdb,
                       min_radius=1.8,
                       max_radius=6.0,
                       eps=4.0,
                       min_samples=6):
    
    atoms, residues = load_atoms(mol_or_pdb)
    coords = np.array([[a["x"],a["y"],a["z"]] for a in atoms])

    if len(coords)<4:
        return {"error":"Too few atoms"}

    try:
        tri = Delaunay(coords)
    except:
        return {"error": "Delaunay triangulation failed"}

    centers=[]
    radii=[]
    simplex_ids=[]

    for simp in tri.simplices:
        p = coords[simp]
        c,r = circumsphere(p)
        if c is None or math.isnan(r): continue
        if min_radius <= r <= max_radius:
            centers.append(c)
            radii.append(r)
            simplex_ids.append(simp)

    if len(centers)==0:
        return {"pockets":[], "meta":{"alpha_spheres":0}}

    centers=np.array(centers)
    radii=np.array(radii)

    labels = cluster(centers, eps=eps, min_pts=min_samples)

    pockets=[]
    atom_tree=cKDTree(coords)

    for pid in set(labels):
        if pid==-1: continue
        mask = labels==pid
        sph = centers[mask]
        rad = radii[mask]

        pocket_center = sph.mean(axis=0)

        # ---- pocket residues ----
        pocket_res=set()
        for c in sph:
            idxs = atom_tree.query_ball_point(c,4.5)
            for idx in idxs:
                a=atoms[idx]
                key=(a["chain"], a["resseq"], a["resname"])
                pocket_res.add(key)

        # ---- hydrophobicity & polarity ----
        hydros=[]
        polar=0
        for ch,num,three in pocket_res:
            aa=AA3.get(three.upper(), None)
            if aa and aa in KD:
                h=KD[aa]
                hydros.append(h)
                if h <= -0.5: polar+=1
        if len(hydros)==0:
            avg_h=0
            polar_frac=0
        else:
            avg_h=float(np.mean(hydros))
            polar_frac = polar/len(hydros)

        # ---- solvent exposure ----
        counts=[]
        for c in sph:
            counts.append(len(atom_tree.query_ball_point(c,8.0)))
        counts=np.array(counts)
        if counts.max()==counts.min(): 
            exposure=0
        else:
            exposure = 1 - (counts.mean()-counts.min())/(counts.max()-counts.min())

        # ---- accurate volume ----
        vol = voxel_volume(sph, rad, resolution=0.75)

        # ---- druggability ----
        size_score = math.tanh(len(sph)/50)
        hydro_pref = math.exp(-((avg_h-1.5)**2)/(2*(1.5**2)))
        exposure_pref = 1 - abs(exposure-0.4)
        polarity_factor = 1 - polar_frac
        drugg = max(0,min(1, size_score*hydro_pref*exposure_pref*polarity_factor))

        pockets.append({
            "id":int(pid),
            "center":pocket_center.tolist(),
            "n_spheres":int(len(sph)),
            "avg_sphere_radius":float(np.mean(rad)),
            "volume":float(vol),
            "residues":[f"{res}:{chain}{num}" for chain,num,res in pocket_res],
            "avg_hydrophobicity":avg_h,
            "polar_frac":polar_frac,
            "solvent_exposure":exposure,
            "druggability":drugg
        })

    pockets.sort(key=lambda x: -x["druggability"])

    return {
        "pockets": pockets,
        "meta":{
            "alpha_spheres":len(centers),
            "clusters":len(set(labels)) - (1 if -1 in labels else 0)
        }
    }