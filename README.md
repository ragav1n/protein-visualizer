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
```bash
cd backend
pip install -r requirements.txt
python main.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```
