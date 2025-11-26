import os

def submit_folding_job(sequence, outdir):
    mock = os.path.join(outdir, "folded.pdb")
    with open(mock, "w") as f:
        f.write("# mock folded structure\n")
    return {"status": "mock", "pdb": mock}