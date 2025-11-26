import math

def detect_pockets(mol, grid=3.0, radius=4.0, threshold=6):
    atoms = mol["atoms"]
    xs = [a["x"] for a in atoms]
    ys = [a["y"] for a in atoms]
    zs = [a["z"] for a in atoms]

    pockets = []

    x = min(xs)
    while x <= max(xs):
        y = min(ys)
        while y <= max(ys):
            z = min(zs)
            while z <= max(zs):
                count = 0
                for a in atoms:
                    dx = a["x"] - x
                    dy = a["y"] - y
                    dz = a["z"] - z
                    if dx*dx + dy*dy + dz*dz <= radius*radius:
                        count += 1
                if count <= threshold:
                    pockets.append({
                        "center": [x, y, z],
                        "score": count
                    })
                z += grid
            y += grid
        x += grid

    pockets.sort(key=lambda p: p["score"])
    return pockets[:10]