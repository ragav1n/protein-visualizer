import { useState } from 'react';
import { ChevronDown, ChevronRight, Table, Box } from 'lucide-react';
import { MoleculeData } from '../api/client';
import { CanvasMoleculeViewer, ColorMode, RenderMode } from './CanvasMoleculeViewer';

interface MoleculeViewerProps {
  moleculeData: MoleculeData;
  selectedAtomIndex: number | null;
  onAtomSelect: (index: number) => void;
  colorMode?: ColorMode;
  renderMode?: RenderMode;
  showLabels?: boolean;
}

export function MoleculeViewer({
  moleculeData,
  selectedAtomIndex,
  onAtomSelect,
  colorMode,
  renderMode,
  showLabels,
}: MoleculeViewerProps) {
  const [isJsonExpanded, setIsJsonExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<'3d' | 'table'>('3d');

  return (
    <div className="space-y-4">
      {/* View Mode Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setViewMode('3d')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-colors ${viewMode === '3d'
            ? 'bg-blue-100 text-blue-700'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
        >
          <Box className="w-4 h-4" />
          3D View
        </button>
        <button
          onClick={() => setViewMode('table')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-colors ${viewMode === 'table'
            ? 'bg-blue-100 text-blue-700'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
        >
          <Table className="w-4 h-4" />
          Table View
        </button>
      </div>

      {/* 3D Viewer */}
      {viewMode === '3d' && (
        <CanvasMoleculeViewer
          moleculeData={moleculeData}
          selectedAtomIndex={selectedAtomIndex}
          onAtomSelect={onAtomSelect}
          colorMode={colorMode}
          renderMode={renderMode}
          showLabels={showLabels}
        />
      )}

      {/* Table View */}
      {viewMode === 'table' && moleculeData.atoms && moleculeData.atoms.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <h3 className="font-medium text-gray-700">Atoms Table</h3>
            <p className="text-xs text-gray-500 mt-1">
              {moleculeData.atoms.length} atoms • Click row to select
            </p>
          </div>
          <div className="overflow-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Index</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Atom</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Residue</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Res#</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">X</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Y</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Z</th>
                </tr>
              </thead>
              <tbody>
                {moleculeData.atoms.map((atom) => (
                  <tr
                    key={atom.atom_index}
                    onClick={() => onAtomSelect(atom.atom_index)}
                    className={`border-b border-gray-100 cursor-pointer transition-colors ${selectedAtomIndex === atom.atom_index
                      ? 'bg-blue-50 hover:bg-blue-100'
                      : 'hover:bg-gray-50'
                      }`}
                  >
                    <td className="px-4 py-2 text-gray-600">{atom.atom_index}</td>
                    <td className="px-4 py-2 text-gray-900 font-medium">{atom.atom_name}</td>
                    <td className="px-4 py-2 text-gray-600">{atom.residue_name}</td>
                    <td className="px-4 py-2 text-gray-600">{atom.residue_number}</td>
                    <td className="px-4 py-2 text-gray-600">{atom.x.toFixed(3)}</td>
                    <td className="px-4 py-2 text-gray-600">{atom.y.toFixed(3)}</td>
                    <td className="px-4 py-2 text-gray-600">{atom.z.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Raw JSON Toggle */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setIsJsonExpanded(!isJsonExpanded)}
          className="w-full px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors"
        >
          <span className="font-medium text-gray-700">Raw JSON Data</span>
          {isJsonExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
        </button>
        {isJsonExpanded && (
          <div className="p-4 bg-gray-50 overflow-auto max-h-96">
            <pre className="text-xs text-gray-700">
              {JSON.stringify(moleculeData, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
