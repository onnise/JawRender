// src/components/Converter.jsx

import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Control, StackPanel, AdvancedDynamicTexture } from '@babylonjs/gui';

import { exportToGLB, exportToSTL } from '../Exporter'; 

const Converter = () => {
  const canvasRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

 
  const { scene, camera, models } = location.state || {};

  useEffect(() => {
    if (!scene || !canvasRef.current) return;

  
    camera.detachControl();
    camera.attachControl(canvasRef.current, true);

    const advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI("ConverterUI", true, scene);
    
    // --- 2. ADD EXPORT BUTTONS TO THE CONVERTER'S UI ---
    const panel = new StackPanel();
    panel.width = "200px";
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    panel.paddingTop = "20px";
    panel.paddingRight = "20px";
    advancedTexture.addControl(panel);
    
    const backButton = Button.CreateSimpleButton("back", "Back to Viewer");
    backButton.height = "40px";
    backButton.color = "white";
    backButton.background = "gray";
    backButton.paddingBottom = "10px";
    backButton.onPointerUpObservable.add(() => navigate('/'));
    panel.addControl(backButton);
    
    // Export to GLB button
    const exportGLBButton = Button.CreateSimpleButton("exportGLB", "Export to GLB");
    exportGLBButton.height = "40px";
    exportGLBButton.color = "white";
    exportGLBButton.background = "blue";
    exportGLBButton.paddingBottom = "10px";
    exportGLBButton.onPointerUpObservable.add(() => {
        // We export the "Full" model group.
        if (models && models.Full) {
            exportToGLB([models.Full], "exported_model");
        }
    });
    panel.addControl(exportGLBButton);

    // Export to STL button
    const exportSTLButton = Button.CreateSimpleButton("exportSTL", "Export to STL");
    exportSTLButton.height = "40px";
    exportSTLButton.color = "white";
    exportSTLButton.background = "orange";
    exportSTLButton.onPointerUpObservable.add(() => {
        // STL exporter needs an array of raw meshes, not the parent node
        if (models && models.Full) {
            const allMeshes = models.Full.getChildMeshes(true);
            exportToSTL(scene, allMeshes, "exported_model.stl");
        }
    });
    panel.addControl(exportSTLButton);


    return () => {
      advancedTexture.dispose();
    }
  }, [scene, camera, models, navigate]); 

  if (!scene) {
    return <div><h2>Error: Converter must be accessed from the Player.</h2></div>
  }

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', outline: 'none' }} />;
};

export default Converter;