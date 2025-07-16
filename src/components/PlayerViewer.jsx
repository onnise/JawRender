import React, { useEffect, useRef, useCallback } from "react"; // <-- 1. Import useCallback
import { useNavigate } from 'react-router-dom';

// --- HELPER FILE IMPORTS ---
import { initBabylon } from "./BabylonEngine";
import { setupGUI } from "./GUIControls"; 
import { initializeCaseLoader } from "./ModelLoader";

// --- BABYLON IMPORTS ---
import { Mesh } from "@babylonjs/core";

const PlayerViewer = () => {
  const canvasRef = useRef(null);
  const activeModelRef = useRef(null); 
  const modelsRef = useRef(null);
  const cameraRef = useRef(null);
  const sceneRef = useRef(null);
  const navigate = useNavigate();

  // 2. Wrap the functions that depend on React state/hooks in useCallback
  // This ensures they are always fresh and prevents stale closures.
  const showModel = useCallback((type) => {
    const models = modelsRef.current;
    const cam = cameraRef.current;

    if (!models || !models.Full || !cam) return;
    
    models.Full.setEnabled(true);
    models.Upper.setEnabled(type === "Upper" || type === "Full");
    models.Lower.setEnabled(type === "Lower" || type === "Full");
    activeModelRef.current = models[type];
    
    if (activeModelRef.current) {
      const allMeshes = activeModelRef.current.getChildMeshes(true).filter(m => m instanceof Mesh);
      if (allMeshes.length > 0) cam.zoomOn(allMeshes, true);
    }
  }, []); // Empty array means this function is created once and never changes

  const handleNavigate = useCallback(() => {
    const currentState = { 
        scene: sceneRef.current, 
        camera: cameraRef.current, 
        models: modelsRef.current 
    };
    navigate('/converter', { state: currentState });
  }, [navigate]); // It depends on `navigate`, so we list it

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { engine, scene, camera } = initBabylon(canvas);
    
    sceneRef.current = scene;
    cameraRef.current = camera;
    
    let guiTexture = null;

    const onModelLoaded = (loadedModels) => {
      modelsRef.current = loadedModels;
      
      // ** 3. NOW we call setupGUI with the guaranteed-fresh functions **
      guiTexture = setupGUI({ 
        scene,
        camera,
        models: loadedModels, // Pass the newly loaded models directly
        showModel,
        activeModelRef,
        onNavigateToConverter: handleNavigate
      });

      showModel("Full"); // Display the initial model
    };
    
    const loaderCleanup = initializeCaseLoader(scene, 'loadCaseButton', 'ztcadLoaderInput', onModelLoaded);
    
    engine.runRenderLoop(() => {
      if (!scene.isDisposed) scene.render();
    });

    const resize = () => engine.resize();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      if(loaderCleanup) loaderCleanup();
      if(guiTexture) guiTexture.dispose();
      engine.dispose();
    };
  // 4. We pass our memoized functions to the dependency array
  }, [showModel, handleNavigate]); 

  // --- The JSX is unchanged ---
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 1 }}>
        <img 
          id="loadCaseButton"
          src="/assets/open.png"
          alt="Load Published Case"
          style={{ width: '40px', height: '40px', cursor: 'pointer', backgroundColor: '#e0e0e0', padding: '5px', borderRadius: '8px' }} 
        />
        <input type="file" id="ztcadLoaderInput" accept=".ztcad" style={{ display: 'none' }} />
      </div>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0, width: "100%", height: "100%", outline: 'none', zIndex: 0 }}
      />
    </div>
  );
};

export default PlayerViewer;