import React, { useEffect, useRef, useCallback, useState } from "react"; 

// --- HELPER FILE IMPORTS ---
import { initBabylon } from "./BabylonEngine";
import { setupGUI } from "./GUIControls"; 
import { initializeCaseLoader } from "./ModelLoader";
import { exportToGLB, exportToSTL } from "./Exporter";
import ExportDrawer from "./ExportDrawer"; 

// --- BABYLON IMPORTS ---
import { Vector3 } from "@babylonjs/core";

const PlayerViewer = () => {
  const canvasRef = useRef(null);
  const activeModelRef = useRef(null); 
  const modelsRef = useRef(null);
  const cameraRef = useRef(null);
  const sceneRef = useRef(null);
  const guiTextureRef = useRef(null);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const cleanupPreviousModel = useCallback(() => {
    if (guiTextureRef.current) {
      guiTextureRef.current.dispose();
      guiTextureRef.current = null;
    }
    if (modelsRef.current && modelsRef.current.MasterRoot) {
      modelsRef.current.MasterRoot.dispose(false, true);
    }
    modelsRef.current = null;
    activeModelRef.current = null;
    setIsModelLoaded(false); 
  }, []);

  // This is your last known working showModel logic, it is kept as is.
  const showModel = useCallback((type) => {
    const models = modelsRef.current;
    const cam = cameraRef.current;
    if (!models || !cam) return;
    
    // Using Object.keys for safety
    Object.keys(models).forEach(key => {
        if(models[key] && models[key].setEnabled && key !== 'MasterRoot'){
            models[key].setEnabled(false);
        }
    });

    if (models.Full) models.Full.setEnabled(true);

    let targetModel = models.Full;

    if (type === 'Upper' && models.Upper) { // Fallback to simpler groups
      models.Upper.setEnabled(true);
      targetModel = models.Upper;
    } else if (type === 'Lower' && models.Lower) {
      models.Lower.setEnabled(true);
      targetModel = models.Lower;
    } else if (type === 'Full') {
        Object.keys(models).forEach(key => {
            if(models[key] && models[key].setEnabled && key !== 'MasterRoot'){
                models[key].setEnabled(true);
            }
        });
        targetModel = models.Full;
    }
    
    activeModelRef.current = targetModel;

    if (activeModelRef.current) {
      setTimeout(() => {
        try {
          cam.setPosition(new Vector3(0, 0, 150));
          cam.setTarget(activeModelRef.current.position || Vector3.Zero());
        } catch (error) { console.error("Error during camera positioning:", error); }
      }, 50);
    }
  }, []);

  // --- FINAL AND FOOLPROOF FIX APPLIED HERE ---

  const handleExport = (exportFunction) => {
    if (!sceneRef.current || !modelsRef.current) {
        alert("Cannot export: The scene or model is not ready.");
        return;
    }
    
    let meshesToExport = [];
    
    // 1. Define all possible groups that can contain meshes. This MUST match your loader.
    const groupsWithMeshes = [
        'Upper', 'Lower', 'UpperGums', 'LowerGums', 'Teeth', 
        'IdealTeeth', 'OriginalTeeth', 'Brackets'
    ];
    
    // 2. Go to each group directly and collect its children. This bypasses all visibility issues.
    groupsWithMeshes.forEach(groupName => {
        const modelGroup = modelsRef.current[groupName];
        if (modelGroup) {
            // Get children that are meshes. The 'false' parameter is important.
            meshesToExport.push(...modelGroup.getChildMeshes(false));
        }
    });

    // 3. Perform the final check and export.
    if (meshesToExport.length > 0) {
        exportFunction(meshesToExport);
    } else {
        alert("Export failed: No valid geometry found in the model.");
    }
    
    setIsDrawerOpen(false);
  };
  
  const handleExportGLB = useCallback(() => {
    handleExport(allMeshes => {
      exportToGLB(sceneRef.current, allMeshes, "exported_model.glb");
    });
  }, []);
  
  const handleExportSTL = useCallback(() => {
    handleExport(allMeshes => {
      exportToSTL(sceneRef.current, allMeshes, "exported_model.stl");
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { engine, scene, camera } = initBabylon(canvas);
    sceneRef.current = scene;
    cameraRef.current = camera;
    
    const onModelLoaded = (loadedModels) => {
      setLoadError(null);
      setIsLoading(false);
      requestAnimationFrame(() => {
        try {
          cleanupPreviousModel();
          modelsRef.current = loadedModels;
          guiTextureRef.current = setupGUI({ 
            canvas, camera, models: loadedModels, showModel,
            activeModelRef, onOpenExportDrawer: () => setIsDrawerOpen(true)
          });
          setIsModelLoaded(true);
          showModel("Full");
        } catch (error) {
          console.error("Error processing loaded model:", error);
          setLoadError("Failed to process loaded model");
        }
      });
    };
    
    const loaderCleanup = initializeCaseLoader(
      scene, 'ztcadLoaderInput', onModelLoaded, setIsLoading, setLoadError
    );
    engine.runRenderLoop(() => { if (scene && !scene.isDisposed) scene.render(); });
    const resize = () => { if(engine) engine.resize(); };
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      if (loaderCleanup) loaderCleanup();
      cleanupPreviousModel();
      if(engine) engine.dispose();
    };
  }, [cleanupPreviousModel, showModel]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <ExportDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onExportGLB={handleExportGLB}
        onExportSTL={handleExportSTL}
      />
      <input type="file" id="ztcadLoaderInput" accept=".ztcad,.glb" style={{ display: 'none' }} />
      {isLoading && (<div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.8)', color: 'white', padding: '20px', borderRadius: '8px', zIndex: 10 }}>Loading model...</div>)}
      {loadError && (<div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(255,0,0,0.9)', color: 'white', padding: '20px', borderRadius: '8px', zIndex: 10, textAlign: 'center' }}><div>{loadError}</div><button onClick={() => setLoadError(null)} style={{ marginTop: '10px', padding: '5px 10px', background: 'white', color: 'red', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Dismiss</button></div>)}
      {!isModelLoaded && !isLoading && (<div style={{ position: 'absolute', top: 10, left: 10, zIndex: 1 }}><button onClick={() => document.getElementById('ztcadLoaderInput')?.click()} style={{ background: '#fff', border: '1px solid #ccc', borderRadius: '8px', padding: '8px', cursor: 'pointer', display: 'flex', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} title="Load Published Case"><img src="/assets/open.png" alt="Load Case" style={{ width: '35px', height: '35px' }} /></button></div>)}
      <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: "100%", height: "100%", outline: 'none' }} />
    </div>
  );
};

export default PlayerViewer;