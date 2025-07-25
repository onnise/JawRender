


import React, { useEffect, useRef, useCallback, useState } from "react";
import { initBabylon } from "./BabylonEngine";
import { setupGUI } from "./GUIControls";
import { initializeCaseLoader } from "./ModelLoader";
import { exportToGLB, exportToSTL } from "./Exporter";
import ExportDrawer from "./ExportDrawer";
import { Vector3, Color3, Texture, PostProcess, Effect } from "@babylonjs/core";
import { parseShaderFile } from "./shaderUtils";


import gumsRenderShader from '../angel-align/rendering/gums-render-pass.glsl?raw';

const PlayerViewer = () => {
    // All of your original state and refs
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

    // This clean useEffect just stores our pre-converted shader
    useEffect(() => {
        if (gumsRenderShader) {
            Effect.ShadersStore["gumsRenderFragmentShader"] = gumsRenderShader;
        } else {
            console.error("The new 'gums-render-pass.glsl' file was not found!");
        }
    }, []);

  const cleanupPreviousModel = useCallback(() => {
    if (guiTextureRef.current) {
      guiTextureRef.current.dispose(); guiTextureRef.current = null;
    }
    if (modelsRef.current && modelsRef.current.MasterRoot) {
      modelsRef.current.MasterRoot.dispose(false, true);
    }
    modelsRef.current = null;
    activeModelRef.current = null;
    setIsModelLoaded(false); 
  }, []);

  const showModel = useCallback((type) => {
    const models = modelsRef.current;
    const cam = cameraRef.current;
    if (!models || !cam) return;
    
    Object.keys(models).forEach(key => {
      if(models[key] && models[key].setEnabled && key !== 'MasterRoot') models[key].setEnabled(false);
    });
    if (models.Full) models.Full.setEnabled(true);
    let targetModel = models.Full;

    if (type === 'Upper' && models.Upper) {
      models.Upper.setEnabled(true); targetModel = models.Upper;
    } else if (type === 'Lower' && models.Lower) {
      models.Lower.setEnabled(true); targetModel = models.Lower;
    } else if (type === 'Full') {
        Object.keys(models).forEach(key => {
            if(models[key] && models[key].setEnabled && key !== 'MasterRoot') models[key].setEnabled(true);
        });
        targetModel = models.Full;
    }
    activeModelRef.current = targetModel;
    if (activeModelRef.current) {
      setTimeout(() => {
        try {
          cam.setPosition(new Vector3(0, 0, 150));
          cam.setTarget(activeModelRef.current.position || Vector3.Zero());
        } catch (error) { console.error("Camera positioning error:", error); }
      }, 50);
    }
  }, []);
  
  const handleExport = useCallback((exportFunction) => {
    if (!sceneRef.current || !modelsRef.current) { return; }
    let meshesToExport = [];
    const groups = ['Upper', 'Lower', 'IdealTeeth', 'OriginalTeeth', 'Brackets', 'Full'];
    groups.forEach(name => {
      if (modelsRef.current[name]) meshesToExport.push(...modelsRef.current[name].getChildMeshes(false));
    });
    if (meshesToExport.length > 0) { exportFunction(meshesToExport); }
    setIsDrawerOpen(false);
  }, []);
  
  const handleExportGLB = useCallback(() => {
    handleExport(meshes => exportToGLB(sceneRef.current, meshes, "exported_model.glb"));
  }, [handleExport]);
  
  const handleExportSTL = useCallback(() => {
    handleExport(meshes => exportToSTL(sceneRef.current, meshes, "exported_model.stl"));
  }, [handleExport]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const { engine, scene, camera } = initBabylon(canvas);
    sceneRef.current = scene;
    cameraRef.current = camera;
    
    const gBuffer = scene.gBuffer;
    if (gBuffer) {
        console.log("G-Buffer found. Setting up visualization post-process.");


 // 1. Load all textures required by the gums shader
            const ASSET_PATH = "/assets/";
            const gumDiffuseTex = new Texture(ASSET_PATH + "angel-align-texture-gums-diffuse.png", scene);
            const gumReflectTex = new Texture(ASSET_PATH + "angel-align-texture-reflection.png", scene);
            const gumSpecularTex = new Texture(ASSET_PATH + "angel-align-6th-pass-step-2-gums-texture-specular.png", scene);
            const gumNormalTex = new Texture(ASSET_PATH + "angel-align-texture-gums-normal.png", scene);

            // 2. Create the new PostProcess for the Gums Pass
            const gumsPass = new PostProcess("gumsRender", "gumsRender",
                [ // Uniforms list. These must match the new shader EXACTLY.
                  "diffuse", "opacity", "ambientLightColor", "selfIllumination", "glossiness",
                  "reflectivity", "shineFactor", "enableTexture",
                  "pointLights[0].position", "pointLights[0].color",
                  "pointLights[1].position", "pointLights[1].color",
                  "pointLights[2].position", "pointLights[2].color"
                ],
                [ // Samplers list. Must also match EXACTLY.
                  "gBufferPosition", "gBufferNormal", "gBufferData",
                  "diffuseMap", "reflectMap", "specularMap", "normalMap"
                ],
            1.0, camera);

            // 3. Define lights for the shader to use
            const pointLights = [
                { position: new Vector3(100, 200, -150), color: new Color3(0.9, 0.8, 0.7) },
                { position: new Vector3(-80, -100, 100), color: new Color3(0.5, 0.5, 0.8) },
                { position: new Vector3(0, -150, -100), color: new Color3(0.4, 0.4, 0.4) },
            ];

            // 4. Set up the onApply callback to send ALL data to the shader
            gumsPass.onApply = (effect) => {
                // Bind G-Buffer textures
                effect.setTexture("gBufferPosition", gBuffer.textures[0]);
                effect.setTexture("gBufferNormal", gBuffer.textures[1]);
                effect.setTexture("gBufferData", gBuffer.textures[2]);
                // Bind Gum textures
                effect.setTexture("diffuseMap", gumDiffuseTex);
                effect.setTexture("reflectMap", gumReflectTex);
                effect.setTexture("specularMap", gumSpecularTex);
                effect.setTexture("normalMap", gumNormalTex);
                // Set other uniforms
                effect.setFloat("opacity", 1.0);
                effect.setVector3("diffuse", new Vector3(1.0, 1.0, 1.0));
                effect.setVector3("ambientLightColor", new Vector3(0.2, 0.2, 0.25));
                effect.setFloat("selfIllumination", 0.0);
                effect.setFloat("glossiness", 0.3);
                effect.setFloat("reflectivity", 0.4);
                effect.setFloat("shineFactor", 0.8);
                effect.setFloat("enableTexture", 1.0); 
                // Pass light data
                pointLights.forEach((light, i) => {
                    effect.setVector3(`pointLights[${i}].position`, light.position);
                    // effect.setVector3(`pointLights[${i}].color`, light.color.toVector3());
                    effect.setVector3(`pointLights[${i}].color`, light.color);
                });
            };

        } else {
            console.error("G-Buffer not found! Cannot set up Gums Render Pass.");
        }


    const onModelLoaded = (loadedModels) => {
      setLoadError(null);
      setIsLoading(false);
       //sceneRef.current.debugLayer.show();

      requestAnimationFrame(() => {
        try {
          cleanupPreviousModel();
          modelsRef.current = loadedModels;
          guiTextureRef.current = setupGUI({ 
            camera, models: loadedModels, showModel,
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
    
    const loaderCleanup = initializeCaseLoader(scene, 'ztcadLoaderInput', onModelLoaded, setIsLoading, setLoadError);
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
      <ExportDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} onExportGLB={handleExportGLB} onExportSTL={handleExportSTL} />
      <input type="file" id="ztcadLoaderInput" accept=".ztcad,.glb" style={{ display: 'none' }} />
      {isLoading && <div style={{position: 'absolute', zIndex:10, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background:'rgba(0,0,0,0.8)', color:'white', padding:'20px', borderRadius:'8px'}}>Loading model...</div>}
      {loadError && <div style={{position: 'absolute', zIndex:10, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background:'rgba(255,0,0,0.9)', color:'white', padding:'20px', borderRadius:'8px', textAlign:'center'}}><div>{loadError}</div><button onClick={() => setLoadError(null)}>Dismiss</button></div>}
      {!isModelLoaded && !isLoading && <div style={{position: 'absolute', top: 10, left: 10, zIndex: 1}}><button onClick={() => document.getElementById('ztcadLoaderInput')?.click()} style={{ background: '#fff', border: '1px solid #ccc', borderRadius: '8px', padding: '8px', cursor: 'pointer', display: 'flex' }} title="Load Published Case"><img src="/assets/open.png" alt="Load Case" style={{ width: '35px', height: '35px' }} /></button></div>}
      <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: "100%", height: "100%", outline: 'none' }} />
    </div>
  );
};

export default PlayerViewer;