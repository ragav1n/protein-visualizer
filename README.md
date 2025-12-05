# Protein Visualizer & Analysis Platform

A comprehensive web application for visualizing and analyzing protein structures. Built with React (Frontend) and FastAPI (Backend).

## Features

### 1. 3D Molecule Visualization
- **Interactive Viewer**: Zoom, rotate, and pan to inspect molecular structures.
- **Render Modes**:
  - **Ball-and-Stick**: Detailed view of atoms and bonds (black bonds for high contrast).
  - **Space-Filling**: Surface proxy representation.
- **Color Modes**:
  - **Element (CPK)**: Standard atomic coloring.
  - **Residue Type**: Shapely color scheme.
  - **Hydrophobicity**: Kyte-Doolittle scale.
  - **B-Factor**: Heatmap representation.
- **Interactive Labels**: Hover over atoms to see residue name, number, and element type.

### 2. Molecular Analysis
- **Pocket Detection**: Identify potential binding sites on the protein surface.
- **Docking**: Simulate ligand docking into detected pockets.
- **Refinement**: Optimize docked poses.
- **Folding**: Predict protein folding (Mock integration).
- **Attack Analysis**: Analyze covalent attack feasibility.

### 3. Job Management
- **Drag-and-Drop Upload**: Easily upload PDB files.
- **Job History**: Track previous analysis jobs and reload them.
- **Persistence**: Jobs are saved to disk and restored on server restart.

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Lucide Icons.
- **Backend**: FastAPI, Biopython, NumPy.
- **Rendering**: Custom HTML5 Canvas renderer.

## Getting Started

### Backend

1. **Install Miniconda**  
Download and install Miniconda from the official guide:  
[Miniconda Installation Instructions](https://www.anaconda.com/docs/getting-started/miniconda/install#quickstart-install-instructions)

2. **Open Anaconda Prompt**  

3. **Navigate to the backend folder and set up the environment**  

```bash
cd backend
conda create -n dock python=3.10 -y
conda activate dock
conda install -c conda-forge openbabel -y
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```
