import { createContext, useContext } from 'react';

interface SchemaDiagramContextValue {
  onOpenPanel: (tableId: string) => void;
  onOpenRectPanel: (rectId: string) => void;
  layoutEditable: boolean;
  onRectangleResizeEnd: (rectId: string, x: number, y: number, width: number, height: number) => void;
}

export const SchemaDiagramContext = createContext<SchemaDiagramContextValue>({
  onOpenPanel: () => {},
  onOpenRectPanel: () => {},
  layoutEditable: false,
  onRectangleResizeEnd: () => {},
});

export const useSchemaDiagram = () => useContext(SchemaDiagramContext);
