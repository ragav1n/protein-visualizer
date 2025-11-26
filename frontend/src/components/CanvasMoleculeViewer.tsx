import { useRef, useEffect, useState } from 'react';
import { MoleculeData } from '../api/client';

export type ColorMode = 'element' | 'residue' | 'hydrophobicity' | 'bfactor';
export type RenderMode = 'ball-and-stick' | 'space-filling';

interface CanvasMoleculeViewerProps {
    moleculeData: MoleculeData;
    width?: number;
    height?: number;
    selectedAtomIndex?: number | null;
    onAtomSelect?: (index: number) => void;
    colorMode?: ColorMode;
    renderMode?: RenderMode;
    showLabels?: boolean;
}

// CPK Coloring
const ELEMENT_COLORS: Record<string, string> = {
    H: '#FFFFFF', C: '#909090', N: '#3050F8', O: '#FF0D0D', S: '#FFFF30', P: '#FFA500', X: '#FF1493',
};

// Shapely Colors (Residue Type)
const RESIDUE_COLORS: Record<string, string> = {
    ASP: '#E60A0A', GLU: '#E60A0A', // Acidic (Red)
    LYS: '#145AFF', ARG: '#145AFF', HIS: '#8282D2', // Basic (Blue)
    CYS: '#E6E600', MET: '#E6E600', // Sulfur (Yellow)
    GLY: '#EBEBEB', ALA: '#C8C8C8', VAL: '#0F820F', LEU: '#0F820F', ILE: '#0F820F', // Aliphatic (Grey/Green)
    PHE: '#3232AA', TYR: '#3232AA', TRP: '#B45AB4', // Aromatic (Blue/Purple)
    SER: '#FA9600', THR: '#FA9600', PRO: '#DC9682', ASN: '#00DCDC', GLN: '#00DCDC', // Polar (Orange/Cyan)
};

// Hydrophobicity (Kyte-Doolittle scale normalized: 0=Hydrophilic (Blue), 1=Hydrophobic (Orange))
const HYDROPHOBICITY: Record<string, number> = {
    ILE: 1.0, VAL: 0.97, LEU: 0.94, PHE: 0.88, CYS: 0.86, MET: 0.74, ALA: 0.70,
    GLY: 0.58, THR: 0.52, SER: 0.50, TRP: 0.49, TYR: 0.47, PRO: 0.36, HIS: 0.17,
    GLU: 0.16, GLN: 0.16, ASP: 0.16, ASN: 0.16, LYS: 0.11, ARG: 0.0,
};

const ELEMENT_RADII: Record<string, number> = {
    H: 1.2, C: 1.7, N: 1.55, O: 1.52, S: 1.8, P: 1.8, X: 1.5,
};

export function CanvasMoleculeViewer({
    moleculeData,
    width = 600,
    height = 400,
    selectedAtomIndex,
    onAtomSelect,
    colorMode = 'element',
    renderMode = 'ball-and-stick',
    showLabels = false,
}: CanvasMoleculeViewerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [rotation, setRotation] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [isDragging, setIsDragging] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
    const [hoveredAtom, setHoveredAtom] = useState<number | null>(null);

    const getTransformedAtoms = () => {
        if (!moleculeData.atoms || moleculeData.atoms.length === 0) return [];

        let cx = 0, cy = 0, cz = 0;
        moleculeData.atoms.forEach(a => { cx += a.x; cy += a.y; cz += a.z; });
        const n = moleculeData.atoms.length;
        cx /= n; cy /= n; cz /= n;

        const cosX = Math.cos(rotation.x);
        const sinX = Math.sin(rotation.x);
        const cosY = Math.cos(rotation.y);
        const sinY = Math.sin(rotation.y);

        return moleculeData.atoms.map(atom => {
            let x = atom.x - cx;
            let y = atom.y - cy;
            let z = atom.z - cz;

            let x1 = x * cosY - z * sinY;
            let z1 = x * sinY + z * cosY;
            let y1 = y;

            let y2 = y1 * cosX - z1 * sinX;
            let z2 = y1 * sinX + z1 * cosX;

            return { ...atom, tx: x1, ty: y2, tz: z2 };
        });
    };

    const getAtomColor = (atom: any) => {
        if (colorMode === 'residue') {
            return RESIDUE_COLORS[atom.residue_name] || '#999999';
        }
        if (colorMode === 'hydrophobicity') {
            const h = HYDROPHOBICITY[atom.residue_name];
            if (h === undefined) return '#999999';
            // Blue (hydrophilic) to Orange (hydrophobic)
            const r = Math.floor(255 * h);
            const g = Math.floor(165 * h + 255 * (1 - h) * 0.8); // Mix
            const b = Math.floor(255 * (1 - h));
            return `rgb(${r},${g},${b})`;
        }
        if (colorMode === 'bfactor') {
            // Simple heatmap: Blue (low) -> Red (high)
            // Assuming B-factor range 0-100 usually
            const b = Math.min(Math.max(atom.b_factor || 0, 0), 100) / 100;
            const red = Math.floor(255 * b);
            const blue = Math.floor(255 * (1 - b));
            return `rgb(${red},0,${blue})`;
        }
        return ELEMENT_COLORS[atom.element] || ELEMENT_COLORS['X'];
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, width, height);

        const atoms = getTransformedAtoms();
        if (atoms.length === 0) return;

        let maxDist = 0;
        atoms.forEach(a => {
            const d = Math.sqrt(a.tx * a.tx + a.ty * a.ty + a.tz * a.tz);
            if (d > maxDist) maxDist = d;
        });
        const scale = (Math.min(width, height) / (2.5 * (maxDist || 1))) * zoom;
        const centerX = width / 2;
        const centerY = height / 2;

        const renderList: Array<{ type: 'atom' | 'bond'; z: number; draw: (ctx: CanvasRenderingContext2D) => void; atom?: any; radius?: number; x?: number; y?: number }> = [];

        atoms.forEach(atom => {
            renderList.push({
                type: 'atom',
                z: atom.tz,
                atom, // Store for label rendering
                draw: (ctx) => {
                    const x = centerX + atom.tx * scale;
                    const y = centerY + atom.ty * scale;
                    const element = atom.element || 'X';
                    const color = getAtomColor(atom);

                    let radius = (ELEMENT_RADII[element] || 1.5) * scale;
                    if (renderMode === 'ball-and-stick') radius *= 0.3;
                    else radius *= 0.8; // Space filling

                    // Store calculated props for label
                    // We can't easily modify the item here, but we can use the atom data later

                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, Math.PI * 2);
                    ctx.fillStyle = color;
                    ctx.fill();

                    const isSelected = selectedAtomIndex === atom.atom_index;
                    const isHovered = hoveredAtom === atom.atom_index;

                    if (isSelected || isHovered) {
                        ctx.strokeStyle = isSelected ? '#3b82f6' : '#fbbf24';
                        ctx.lineWidth = isSelected ? 3 : 2;
                        ctx.stroke();
                    } else {
                        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            });
        });

        if (renderMode === 'ball-and-stick' && moleculeData.bonds) {
            moleculeData.bonds.forEach(bond => {
                const atomA = atoms.find(a => a.atom_index === bond.a);
                const atomB = atoms.find(a => a.atom_index === bond.b);

                if (atomA && atomB) {
                    const zMid = (atomA.tz + atomB.tz) / 2;
                    renderList.push({
                        type: 'bond',
                        z: zMid,
                        draw: (ctx) => {
                            const x1 = centerX + atomA.tx * scale;
                            const y1 = centerY + atomA.ty * scale;
                            const x2 = centerX + atomB.tx * scale;
                            const y2 = centerY + atomB.ty * scale;

                            ctx.beginPath();
                            ctx.moveTo(x1, y1);
                            ctx.lineTo(x2, y2);
                            ctx.strokeStyle = '#000000';
                            ctx.lineWidth = 2 * scale * 0.1;
                            ctx.stroke();
                        }
                    });
                }
            });
        }

        renderList.sort((a, b) => a.z - b.z);
        renderList.forEach(item => item.draw(ctx));

        // Draw labels in a separate pass on top
        if (showLabels) {
            atoms.forEach(atom => {
                const isSelected = selectedAtomIndex === atom.atom_index;
                const isHovered = hoveredAtom === atom.atom_index;

                if (isSelected || isHovered) {
                    const x = centerX + atom.tx * scale;
                    const y = centerY + atom.ty * scale;
                    const element = atom.element || 'X';
                    let radius = (ELEMENT_RADII[element] || 1.5) * scale;
                    if (renderMode === 'ball-and-stick') radius *= 0.3;
                    else radius *= 0.8;

                    const text = `${atom.residue_name}${atom.residue_number} (${atom.element})`;
                    ctx.font = 'bold 12px Inter, sans-serif';
                    const textMetrics = ctx.measureText(text);
                    const padding = 4;
                    const boxWidth = textMetrics.width + padding * 2;
                    const boxHeight = 20;

                    // Position label above the atom
                    const labelX = x - boxWidth / 2;
                    const labelY = y - radius - boxHeight - 4;

                    // Draw background box
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                    ctx.strokeStyle = '#cbd5e1';
                    ctx.lineWidth = 1;

                    ctx.beginPath();
                    ctx.roundRect(labelX, labelY, boxWidth, boxHeight, 4);
                    ctx.fill();
                    ctx.stroke();

                    // Draw text
                    ctx.fillStyle = '#0f172a';
                    ctx.fillText(text, labelX + padding, labelY + 14);

                    // Draw connecting line
                    ctx.beginPath();
                    ctx.moveTo(x, y - radius);
                    ctx.lineTo(x, labelY + boxHeight);
                    ctx.strokeStyle = '#94a3b8';
                    ctx.stroke();
                }
            });
        }

    }, [moleculeData, rotation, zoom, width, height, selectedAtomIndex, hoveredAtom, colorMode, renderMode, showLabels]);

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = -Math.sign(e.deltaY) * 0.1;
        setZoom(prev => Math.max(0.1, Math.min(5, prev + delta)));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setLastMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (isDragging) {
            const deltaX = e.clientX - lastMousePos.x;
            const deltaY = e.clientY - lastMousePos.y;
            setRotation(prev => ({ x: prev.x + deltaY * 0.01, y: prev.y + deltaX * 0.01 }));
            setLastMousePos({ x: e.clientX, y: e.clientY });
        } else {
            // Hover detection
            const atoms = getTransformedAtoms();
            let maxDist = 0;
            atoms.forEach(a => {
                const d = Math.sqrt(a.tx * a.tx + a.ty * a.ty + a.tz * a.tz);
                if (d > maxDist) maxDist = d;
            });
            const scale = (Math.min(width, height) / (2.5 * (maxDist || 1))) * zoom;
            const centerX = width / 2;
            const centerY = height / 2;

            const sortedAtoms = [...atoms].sort((a, b) => a.tz - b.tz);
            let found = null;

            for (let i = sortedAtoms.length - 1; i >= 0; i--) {
                const atom = sortedAtoms[i];
                const ax = centerX + atom.tx * scale;
                const ay = centerY + atom.ty * scale;
                const element = atom.element || 'X';
                let radius = (ELEMENT_RADII[element] || 1.5) * scale;
                if (renderMode === 'ball-and-stick') radius *= 0.3;
                else radius *= 0.8;

                const dx = x - ax;
                const dy = y - ay;
                if (dx * dx + dy * dy <= radius * radius) {
                    found = atom.atom_index;
                    break;
                }
            }
            setHoveredAtom(found);
        }
    };

    const handleMouseUp = () => {
        if (!isDragging && onAtomSelect && hoveredAtom !== null) {
            onAtomSelect(hoveredAtom);
        }
        setIsDragging(false);
    };

    return (
        <div className="relative border border-gray-200 rounded-lg overflow-hidden bg-slate-50">
            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => { setIsDragging(false); setHoveredAtom(null); }}
                onWheel={handleWheel}
                className="cursor-move w-full h-full block"
                style={{ width: '100%', height: 'auto', aspectRatio: `${width}/${height}` }}
            />
            <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur px-3 py-1 rounded-full text-xs font-medium text-gray-600 shadow-sm pointer-events-none">
                Drag to rotate • Scroll to zoom • Hover for details
            </div>
        </div>
    );
}
