


import React, { useEffect, useRef, useCallback, useState } from "react";
import { initBabylon } from "./BabylonEngine";
import { setupGUI } from "./GUIControls";
import { initializeCaseLoader } from "./ModelLoader";
import { exportToGLB, exportToSTL } from "./Exporter";
import ExportDrawer from "./ExportDrawer";
import { Vector3, Color3, Texture, PostProcess, Effect } from "@babylonjs/core";
import * as BABYLON from "@babylonjs/core";
import { parseShaderFile } from "./shaderUtils";


import gumsRenderShader from '../angel-align/rendering/gums-render-pass.glsl?raw';
import position_normal_color_vs from '../shaders/position_normal_color.vs?raw';
import position_normal_color_fs from '../shaders/position_normal_color.fs?raw';

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
            if (models[key] && models[key].setEnabled && key !== 'MasterRoot') models[key].setEnabled(false);
        });
        if (models.Full) models.Full.setEnabled(true);
        let targetModel = models.Full;

        if (type === 'Upper' && models.Upper) {
            models.Upper.setEnabled(true); targetModel = models.Upper;
        } else if (type === 'Lower' && models.Lower) {
            models.Lower.setEnabled(true); targetModel = models.Lower;
        } else if (type === 'Full') {
            Object.keys(models).forEach(key => {
                if (models[key] && models[key].setEnabled && key !== 'MasterRoot') models[key].setEnabled(true);
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

        // const screenScene = new BABYLON.Scene(engine);
        
        // scene.useOrderIndependentTransparency = true;

        // Ambient (fill) + Directional (key) light combo
        const hemi = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), scene);
        hemi.intensity = 0.3;

        const sun = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(-1, -2, -1), scene);
        sun.position = new BABYLON.Vector3(10, 20, 10);
        sun.intensity = 1.0;

        let position_normal_color_target;
        {
            position_normal_color_target = new BABYLON.MultiRenderTarget(
                "position_normal_color",
                { width: engine.getRenderWidth(), height: engine.getRenderHeight() },
                3, // 3 output textures
                scene,
                {
                    defaultType: BABYLON.Engine.TEXTURETYPE_FLOAT,
                }
            );
            position_normal_color_target.activeCamera = camera;
            position_normal_color_target.renderList = null; // Entire scene

            Effect.ShadersStore["position_normal_colorVertexShader"] = position_normal_color_vs;
            Effect.ShadersStore["position_normal_colorFragmentShader"] = position_normal_color_fs;
            const position_normal_color_material = new BABYLON.ShaderMaterial("shader", scene, "position_normal_color", {
                attributes: ["position", "normal"],
                uniforms: ["world", "worldViewProjection"],
            });

            // Store original materials and apply shader
            const originalMaterials = new Map();
            let original_useOrderIndependentTransparency = scene.useOrderIndependentTransparency;

            position_normal_color_target.onBeforeRenderObservable.add(() => {
                original_useOrderIndependentTransparency = scene.useOrderIndependentTransparency;
                scene.useOrderIndependentTransparency = false;

                if (modelsRef.current) {
                    for (const mesh of modelsRef.current.allMeshes) {
                        if (mesh.material) {
                            originalMaterials.set(mesh, mesh.material);
                            mesh.material = position_normal_color_material;
                        }
                    }
                }
            })

            // Restore materials after rendering target
            position_normal_color_target.onAfterUnbindObservable.add(() => {
                scene.useOrderIndependentTransparency = original_useOrderIndependentTransparency;
                for (const [mesh, material] of originalMaterials.entries()) {
                    mesh.material = material;
                }
                originalMaterials.clear();
            });

            scene.customRenderTargets.push(position_normal_color_target);
        }


        // const screenCamera = new BABYLON.FreeCamera("orthoCam", new BABYLON.Vector3(0, 0, -10), screenScene);
        // screenCamera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
        // // Set orthographic frustum to cover the viewport
        // const width = engine.getRenderWidth();
        // const height = engine.getRenderHeight();
        // screenCamera.orthoLeft = -width / 2;
        // screenCamera.orthoRight = width / 2;
        // screenCamera.orthoTop = height / 2;
        // screenCamera.orthoBottom = -height / 2;
        // screenCamera.setTarget(BABYLON.Vector3.Zero());

        // // Display texture on a plane
        // const screenPlane = BABYLON.MeshBuilder.CreatePlane("screen", { width: width, height: height }, screenScene);
        // screenPlane.position.z = 0;

        // const screenMaterial = new BABYLON.StandardMaterial("screenMat", screenScene);
        // screenMaterial.diffuseTexture = position_normal_color_target.textures[0];
        // screenPlane.material = screenMaterial;


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
        const resize = () => { if (engine) engine.resize(); };
        window.addEventListener("resize", resize);

        return () => {
            window.removeEventListener("resize", resize);
            if (loaderCleanup) loaderCleanup();
            cleanupPreviousModel();
            if (engine) engine.dispose();
        };
    }, [cleanupPreviousModel, showModel]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <ExportDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} onExportGLB={handleExportGLB} onExportSTL={handleExportSTL} />
            <input type="file" id="ztcadLoaderInput" accept=".ztcad,.glb" style={{ display: 'none' }} />
            {isLoading && <div style={{ position: 'absolute', zIndex: 10, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'rgba(0,0,0,0.8)', color: 'white', padding: '20px', borderRadius: '8px' }}>Loading model...</div>}
            {loadError && <div style={{ position: 'absolute', zIndex: 10, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'rgba(255,0,0,0.9)', color: 'white', padding: '20px', borderRadius: '8px', textAlign: 'center' }}><div>{loadError}</div><button onClick={() => setLoadError(null)}>Dismiss</button></div>}
            {!isModelLoaded && !isLoading && <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 1 }}><button onClick={() => document.getElementById('ztcadLoaderInput')?.click()} style={{ background: '#fff', border: '1px solid #ccc', borderRadius: '8px', padding: '8px', cursor: 'pointer', display: 'flex' }} title="Load Published Case"><img src="/assets/open.png" alt="Load Case" style={{ width: '35px', height: '35px' }} /></button></div>}
            <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: "100%", height: "100%", outline: 'none' }} />
        </div>
    );
};

export default PlayerViewer;