import urllib.request
import urllib.parse
import json
import time
import os
import sys
import mimetypes

BASE_URL = "http://localhost:8000"
INPUTS_DIR = "inputs"
PDB_FILE = os.path.join(INPUTS_DIR, "1CRN.pdb")
LIGAND_FILE = os.path.join(INPUTS_DIR, "lig.sdf")

def multipart_post(url, fields, files):
    boundary = '---BOUNDARY---'
    body = []

    for key, value in fields.items():
        body.append(f'--{boundary}')
        body.append(f'Content-Disposition: form-data; name="{key}"')
        body.append('')
        body.append(str(value))

    for key, filepath in files.items():
        filename = os.path.basename(filepath)
        mime_type = mimetypes.guess_type(filename)[0] or 'application/octet-stream'
        with open(filepath, 'rb') as f:
            file_content = f.read()
        
        body.append(f'--{boundary}')
        body.append(f'Content-Disposition: form-data; name="{key}"; filename="{filename}"')
        body.append(f'Content-Type: {mime_type}')
        body.append('')
        # We need to append bytes, so we handle this differently below
        pass

    # Construct full body
    final_body = b""
    for key, value in fields.items():
        final_body += f'--{boundary}\r\n'.encode()
        final_body += f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode()
        final_body += f'{value}\r\n'.encode()
    
    for key, filepath in files.items():
        filename = os.path.basename(filepath)
        mime_type = mimetypes.guess_type(filename)[0] or 'application/octet-stream'
        with open(filepath, 'rb') as f:
            file_content = f.read()
        
        final_body += f'--{boundary}\r\n'.encode()
        final_body += f'Content-Disposition: form-data; name="{key}"; filename="{filename}"\r\n'.encode()
        final_body += f'Content-Type: {mime_type}\r\n\r\n'.encode()
        final_body += file_content
        final_body += b'\r\n'

    final_body += f'--{boundary}--\r\n'.encode()

    req = urllib.request.Request(url, data=final_body)
    req.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')
    return urllib.request.urlopen(req)

def test_docking_flow():
    print(f"Starting Backend Test (urllib)...")
    print(f"Using PDB: {PDB_FILE}")
    print(f"Using Ligand: {LIGAND_FILE}")

    # 1. Upload PDB
    print("\n[1] Uploading PDB...")
    try:
        resp = multipart_post(f"{BASE_URL}/upload_pdb", {}, {"file": PDB_FILE})
        data = json.loads(resp.read().decode())
        job_id = data["job_id"]
        pdb_id = data["pdb_id"]
        print(f"SUCCESS: Job ID: {job_id}, PDB ID: {pdb_id}")
    except Exception as e:
        print(f"FAILED: Upload failed {e}")
        return

    # 2. Detect Pockets
    print("\n[2] Detecting Pockets...")
    try:
        data = urllib.parse.urlencode({"pdb_id": pdb_id}).encode()
        req = urllib.request.Request(f"{BASE_URL}/job/{job_id}/detect_pockets", data=data)
        resp = urllib.request.urlopen(req)
        pockets_data = json.loads(resp.read().decode())
        pockets = pockets_data.get("pockets", [])
        
        if not pockets:
            print("FAILED: No pockets detected.")
            return

        print(f"SUCCESS: Found {len(pockets)} pockets. Using first pocket.")
        target_pocket = pockets[0]
        print(f"Target Pocket Center: {target_pocket.get('center')}")
    except Exception as e:
        print(f"FAILED: Pocket detection failed {e}")
        return

    # 3. Start Docking
    print("\n[3] Starting Docking...")
    pocket_json = json.dumps(target_pocket)
    try:
        resp = multipart_post(
            f"{BASE_URL}/job/{job_id}/start_docking", 
            {"receptor_pdb_id": pdb_id, "pocket_data": pocket_json}, 
            {"ligand_file": LIGAND_FILE}
        )
        dock_data = json.loads(resp.read().decode())
        docking_id = dock_data["docking_id"]
        print(f"SUCCESS: Docking queued. ID: {docking_id}")
    except Exception as e:
        print(f"FAILED: Docking start failed {e}")
        # print error body if possible
        return

    # 4. Poll for Results
    print("\n[4] Polling for Results...")
    max_retries = 60
    for i in range(max_retries):
        try:
            with urllib.request.urlopen(f"{BASE_URL}/job/{job_id}/docking/{docking_id}/result") as resp:
                result = json.loads(resp.read().decode())
                status = result.get("status")
                print(f"Poll {i+1}: {status}")
                
                if status == "done":
                    print("\n[5] Docking Completed!")
                    print(f"Best Energy: {result.get('best_energy')} kcal/mol")
                    print(f"Output PDB: {result.get('output_pdb')}")
                    
                    if result.get("output_pdb"):
                        print("SUCCESS: out.pdb generated.")
                    else:
                        print("FAILED: out.pdb NOT generated.")
                    
                    if result.get("best_energy") is not None and result.get("best_energy") != 0.0:
                         print("SUCCESS: Energy parsed.")
                    else:
                         print("WARNING: Energy is 0.0 or None.")
                    return
                
                if status == "error":
                    print(f"FAILED: Docking job failed with error: {result.get('error')}")
                    return
        except urllib.error.HTTPError as e:
            if e.code == 404:
                print(f"Poll {i+1}: Not ready (404)")
            else:
                 print(f"Poll {i+1}: Error {e}")
        except Exception as e:
            print(f"Poll {i+1}: Error {e}")
        
        time.sleep(2)
    
    print("FAILED: Timeout waiting for docking.")

if __name__ == "__main__":
    test_docking_flow()
