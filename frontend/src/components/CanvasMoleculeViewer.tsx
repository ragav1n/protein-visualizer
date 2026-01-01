import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { MoleculeData } from '../api/client';

export type ColorMode = 'element' | 'residue' | 'hydrophobicity' | 'bfactor';
export type RenderMode = 'ball-and-stick' | 'space-filling' | 'backbone' | 'cartoon';

interface CanvasMoleculeViewerProps {
    moleculeData: MoleculeData;
    selectedAtomIndex: number | null;
    onAtomSelect: (index: number) => void;
    colorMode?: ColorMode;
    renderMode?: RenderMode;
    showLabels?: boolean;
}

const CPK_COLORS: Record<string, string> = {
    H: '#FFFFFF',
    C: '#909090',
    N: '#3050F8',
    O: '#FF0D0D',
    S: '#FFFF30',
    P: '#FFA500',
    F: '#90E050',
    CL: '#1FF01F',
    BR: '#A62929',
    I: '#940094',
    FE: '#E06633',
    MG: '#8AFF00',
};

const getAtomColor = (element: string = '', residue: string = '', colorMode: ColorMode) => {
    if (colorMode === 'residue') {
        // Simple residue hashing for demo
        let hash = 0;
        for (let i = 0; i < residue.length; i++) hash = residue.charCodeAt(i) + ((hash << 5) - hash);
        const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
        return '#' + '00000'.substring(0, 6 - c.length) + c;
    }
    return CPK_COLORS[element.toUpperCase()] || '#FF1493'; // DeepPink fallback
};

export function CanvasMoleculeViewer({
    moleculeData,
    selectedAtomIndex,
    onAtomSelect,
    colorMode = 'element',
    renderMode = 'ball-and-stick',
}: CanvasMoleculeViewerProps) {

    const { atoms, bonds } = moleculeData;

    // Calculate center of mass for camera target
    const center = useMemo(() => {
        if (!atoms || atoms.length === 0) return [0, 0, 0] as [number, number, number];
        let x = 0, y = 0, z = 0;
        atoms.forEach(a => { x += a.x; y += a.y; z += a.z; });
        return [x / atoms.length, y / atoms.length, z / atoms.length] as [number, number, number];
    }, [atoms]);

    return (
        <div className="w-full h-[600px] border border-slate-200 rounded-xl overflow-hidden bg-white">
            <Canvas>
                <PerspectiveCamera makeDefault position={[0, 0, 40]} />
                <OrbitControls target={center as any} />
                <ambientLight intensity={0.5} />
                <directionalLight position={[10, 10, 10]} intensity={1} />
                <directionalLight position={[-10, -10, -10]} intensity={0.5} />

                <group>
                    {atoms?.map((atom) => (
                        <mesh
                            key={atom.atom_index}
                            position={[atom.x, atom.y, atom.z]}
                            onClick={(e) => {
                                e.stopPropagation();
                                onAtomSelect(atom.atom_index);
                            }}
                        >
                            <sphereGeometry args={[renderMode === 'space-filling' ? 1.5 : 0.4, 16, 16]} />
                            <meshStandardMaterial
                                color={selectedAtomIndex === atom.atom_index ? '#00FF00' : getAtomColor(atom.element, atom.residue_name, colorMode)}
                                emissive={selectedAtomIndex === atom.atom_index ? '#00AA00' : '#000000'}
                            />
                        </mesh>
                    ))}

                    {renderMode !== 'space-filling' && bonds?.map((bond, i) => {
                        const start = atoms.find(a => a.atom_index === bond.a);
                        const end = atoms.find(a => a.atom_index === bond.b);
                        if (!start || !end) return null;

                        // Calculate cylinder position and orientation
                        const startVec = new THREE.Vector3(start.x, start.y, start.z);
                        const endVec = new THREE.Vector3(end.x, end.y, end.z);
                        const mid = new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5);
                        const dist = startVec.distanceTo(endVec);

                        return (
                            <mesh key={`bond-${i}`} position={mid} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), endVec.clone().sub(startVec).normalize())}>
                                <cylinderGeometry args={[0.15, 0.15, dist, 8]} />
                                <meshStandardMaterial color="#A0A0A0" />
                            </mesh>
                        );
                    })}
                </group>
            </Canvas>
        </div>
    );
}
