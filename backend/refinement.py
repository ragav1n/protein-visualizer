import os, shutil

def run_refinement_job(pdb_id, pose_file, outdir):
    # OpenMM-ready but mocked for now
    refined = os.path.join(outdir, "refined.pdb")

    try:
        shutil.copy(pose_file, refined)
    except:
        with open(refined, "w") as f:
            f.write("# mock refined\n")

    return {
        "status": "mock",
        "refined_pose": refined,
        "mmgbsa": -20.5,
        "rmsd": [0.0, 0.1, 0.08]
    }