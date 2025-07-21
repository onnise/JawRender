import React from 'react';
import './ExportDrawer.css';

const ExportDrawer = ({ isOpen, onClose, onExportGLB, onExportSTL }) => {
  return (
    <div className={`export-drawer ${isOpen ? 'open' : ''}`}>
      <div className="export-drawer-header">
        <h3>Export Options</h3>
        <button onClick={onClose} className="close-btn">&times;</button>
      </div>
      <div className="export-drawer-content">
        <p>Choose an export format:</p>
        <button onClick={onExportGLB} className="export-btn">Export to .GLB</button>
        <button onClick={onExportSTL} className="export-btn">Export to .STL</button>
      </div>
    </div>
  );
};

export default ExportDrawer;
