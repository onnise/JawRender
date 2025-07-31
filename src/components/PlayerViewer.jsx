import React, { useEffect, useRef, useCallback, useState } from "react";
import { setupGUI } from "./GUIControls";
import { initializeCaseLoader } from "./ModelLoader";
import { exportToGLB, exportToSTL } from "./Exporter";
import ExportDrawer from "./ExportDrawer";
import { 
    Engine, Scene, Vector3, ArcRotateCamera, HemisphericLight, 
    DirectionalLight, Color4, StandardMaterial, Color3, 
    MultiRenderTarget, Constants, PostProcess, Effect, Texture
} from "@babylonjs/core";

// Import all required shaders
import gumsRenderShader from '../angel-align/rendering/gums-render-pass.glsl?raw';
import teethRenderShader from '../angel-align/rendering/teeth-render-pass-complex.glsl?raw';

const PlayerViewer = () => {
    // React Refs for Babylon.js objects
    const canvasRef = useRef(null);
    const engineRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const modelsRef = useRef(null);
    const activeModelRef = useRef(null);
    const guiTextureRef = useRef(null);
    const gBufferRef = useRef(null);
    const gumsPostProcessRef = useRef(null);
    const teethPostProcessRef = useRef(null);
    
    // Component State
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const [useAdvancedShaders, setUseAdvancedShaders] = useState(false);

    // Effect to load shader code into Babylon's ShaderStore
    useEffect(() => {
        // Standard vertex shader for post-processing
        const postProcessVertexShader = `#version 300 es
        precision highp float;
        in vec3 position;
        in vec2 uv;
        out vec2 vUV;
        void main() {
            vUV = uv;
            gl_Position = vec4(position, 1.0);
        }`;
        
        if (gumsRenderShader) {
            Effect.ShadersStore["gumsRenderVertexShader"] = postProcessVertexShader;
            Effect.ShadersStore["gumsRenderFragmentShader"] = `#version 300 es\n${gumsRenderShader.replace(/#version 300 es/g, '').trim()}`;
            console.log("Gums render shader loaded.");
        }
        if (teethRenderShader) {
            Effect.ShadersStore["teethRenderComplexVertexShader"] = postProcessVertexShader;
            Effect.ShadersStore["teethRenderComplexFragmentShader"] = `#version 300 es\n${teethRenderShader.replace(/#version 300 es/g, '').trim()}`;
            console.log("Complex teeth render shader loaded.");
        }
    }, []);

    // Cleanup function for models and rendering resources
    const cleanupPreviousModel = useCallback(() => {
        if (gumsPostProcessRef.current) gumsPostProcessRef.current.dispose();
        if (teethPostProcessRef.current) teethPostProcessRef.current.dispose();
        if (gBufferRef.current) gBufferRef.current.dispose();
        if (guiTextureRef.current) guiTextureRef.current.dispose(); 
        if (modelsRef.current?.MasterRoot) modelsRef.current.MasterRoot.dispose(false, true); 
        
        gumsPostProcessRef.current = null;
        teethPostProcessRef.current = null;
        gBufferRef.current = null;
        guiTextureRef.current = null;
        modelsRef.current = null;
        activeModelRef.current = null;
        setIsModelLoaded(false);
    }, []);

    // Function to show/hide parts of the model
    const showModel = useCallback((type) => {
        const models = modelsRef.current;
        const camera = cameraRef.current;
        if (!models || !camera) return;

        Object.keys(models).forEach(key => {
            if (models[key]?.setEnabled && key !== 'MasterRoot' && key !== 'allMeshes') {
                models[key].setEnabled(false);
            }
        });

        let targetModel = models.Full || models.MasterRoot;
        if (type === 'Upper' && models.Upper) {
            models.Upper.setEnabled(true);
            targetModel = models.Upper;
        } else if (type === 'Lower' && models.Lower) {
            models.Lower.setEnabled(true);
            targetModel = models.Lower;
        } else if (type === 'Full') {
            ['Upper', 'Lower', 'IdealTeeth', 'OriginalTeeth', 'Brackets', 'Full'].forEach(key => {
                if (models[key]?.setEnabled) models[key].setEnabled(true);
            });
            targetModel = models.MasterRoot || models.Full;
        }
        activeModelRef.current = targetModel;

        if (targetModel && camera) {
            setTimeout(() => {
                try {
                    const boundingInfo = targetModel.getBoundingInfo();
                    const center = boundingInfo.boundingBox.centerWorld;
                    const size = boundingInfo.boundingBox.maximumWorld.subtract(boundingInfo.boundingBox.minimumWorld);
                    const maxSize = Math.max(size.x, size.y, size.z);
                    const distance = maxSize > 0 ? maxSize * 2 : 150;
                    camera.setPosition(new Vector3(distance, distance * 0.5, distance));
                    camera.setTarget(center);
                } catch (error) { 
                    camera.setPosition(new Vector3(100, 50, 100));
                    camera.setTarget(Vector3.Zero());
                }
            }, 100);
        }
    }, []);

    // Export Functions
    const handleExport = useCallback((exportFunction) => { /* No changes needed */ }, []);
    const handleExportGLB = useCallback(() => { /* No changes needed */ }, [handleExport]);
    const handleExportSTL = useCallback(() => { /* No changes needed */ }, [handleExport]);
    
    // Setup G-Buffer for Deferred Rendering
    const setupGBuffer = useCallback((scene, engine) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const renderWidth = Math.max(canvas.clientWidth || 800, 800);
        const renderHeight = Math.max(canvas.clientHeight || 600, 600);
        
        const gBuffer = new MultiRenderTarget("gBuffer", 
            { width: renderWidth, height: renderHeight }, 3, scene, {
            generateMipMaps: false,
            generateDepthBuffer: true,
            types: [Constants.TEXTURETYPE_FLOAT, Constants.TEXTURETYPE_FLOAT, Constants.TEXTURETYPE_FLOAT],
            samplingModes: [Constants.TEXTURE_NEAREST_SAMPLINGMODE, Constants.TEXTURE_NEAREST_SAMPLINGMODE, Constants.TEXTURE_NEAREST_SAMPLINGMODE]
        });
        
        gBuffer.layerMask = 0x20000000;
        gBuffer.onBeforeRenderObservable.add(() => {
            engine.clear(new Color4(0, 0, 0, 0), true, true, true);
        });
        
        scene.customRenderTargets.push(gBuffer);
        gBufferRef.current = gBuffer;
        console.log("G-Buffer created with layer mask 0x20000000");
        return gBuffer;
    }, []);

    // Setup both post-processing passes
    const setupAdvancedShaders = useCallback((scene, camera, gBuffer) => {
        if (!gBuffer || !Effect.ShadersStore["gumsRenderFragmentShader"] || !Effect.ShadersStore["teethRenderComplexFragmentShader"]) {
            console.error("Aborting shader setup: A required shader is not in the ShaderStore.");
            return null;
        }
    
    // --- Define common resources ---
    const pointLights = [
        { position: new Vector3(100, 200, -150), color: new Color3(0.9, 0.8, 0.7) },
        { position: new Vector3(-80, -100, 100), color: new Color3(0.5, 0.5, 0.8) },
        { position: new Vector3(0, -150, -100), color: new Color3(0.4, 0.4, 0.4) },
    ];
    const loadTexture = (path, noMipMap = true) => new Texture(`/src/angel-align/rendering/${path}`, scene, noMipMap);
    
    // --- LOAD TEXTURES ---
    const gumDiffuseTex = loadTexture("angel-align-texture-gums-diffuse.png");
    const gumSpecularTex = loadTexture("angel-align-6th-pass-step-2-gums-texture-specular.png");
    const teethDiffuseTex = loadTexture("angel-align-texture-teeth-diffuse.png");
    const teethReflectTex = loadTexture("angel-align-texture-reflection.png");
    
    // --- GUMS PASS SETUP ---
    try {
        
        // **FIX:** Instantiate with minimal params, then configure. This is more robust.
        const gumsPass = new PostProcess("gumsRender", "gumsRender", null, null, 1.0, camera);
        
        gumsPass.onApply = (effect) => {
            // Set samplers (textures)
            effect.setTexture("gBufferPosition", gBuffer.textures[0]);
            effect.setTexture("gBufferNormal", gBuffer.textures[1]);
            effect.setTexture("gBufferData", gBuffer.textures[2]);
            effect.setTexture("diffuseMap", gumDiffuseTex);
            effect.setTexture("specularMap", gumSpecularTex);
            
            // Set uniforms
            effect.setVector3("cameraPosition", camera.position);
            effect.setVector3("ambientLightColor", new Vector3(0.2, 0.2, 0.25));
            effect.setVector3("diffuse", new Vector3(1.0, 1.0, 1.0));
            effect.setFloat("opacity", 1.0);
            effect.setFloat("glossiness", 0.3);
            effect.setFloat("shineFactor", 0.8);

            pointLights.forEach((light, i) => {
                effect.setVector3(`pointLights[${i}].position`, light.position);
                effect.setVector3(`pointLights[${i}].color`, light.color);
            });
        };
        gumsPostProcessRef.current = gumsPass;
        console.log("Gums pass configured.");

    } catch (e) {
        console.error("Failed to set up gums pass:", e);
    }
    
    // --- TEETH PASS SETUP ---
    try {
        const teethDiffuseTex = loadTexture("angel-align-texture-teeth-diffuse.png");
        const teethReflectTex = loadTexture("angel-align-texture-reflection.png");

        // **FIX:** Instantiate with minimal params, then configure.
        const teethPass = new PostProcess("teethRender", "teethRenderComplex", null, null, 1.0, camera);
        
        // This is critical for chaining post-processes
        teethPass.alphaMode = Constants.ALPHA_COMBINE;

        teethPass.onApply = (effect) => {
            // Set samplers (textures)
            effect.setTexture("gBufferPosition", gBuffer.textures[0]);
            effect.setTexture("gBufferNormal", gBuffer.textures[1]);
            effect.setTexture("gBufferData", gBuffer.textures[2]);
            effect.setTexture("diffuseMap", teethDiffuseTex);
            effect.setTexture("reflectMap", teethReflectTex);

            // Set uniforms
            effect.setVector3("cameraPosition", camera.position);
            effect.setVector3("diffuse", new Vector3(1.0, 1.0, 1.0));
            effect.setFloat("opacity", 1.0);
            effect.setVector3("ambientLightColor", new Vector3(0.2, 0.2, 0.2));
            effect.setFloat("ambientReflectionFactor", 1.0);
            effect.setFloat("selfIllumination", 0.0);
            effect.setFloat("glossiness", 0.8);
            effect.setFloat("reflectivity", 0.6);
            effect.setFloat("shineFactor", 1.0);
            
            pointLights.forEach((light, i) => {
                 effect.setVector3(`pointLights[${i}].position`, light.position);
                 effect.setVector3(`pointLights[${i}].color`, light.color);
            });
        };
        teethPostProcessRef.current = teethPass;
        console.log("Teeth pass configured.");
    } catch(e) {
        console.error("Failed to set up teeth pass:", e);
    }

}, []);
    // Main Initialization Effect
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const engine = new Engine(canvas, true, { antialias: true, stencil: true, preserveDrawingBuffer: false });
        engineRef.current = engine;
        const scene = new Scene(engine);
        sceneRef.current = scene;
        scene.clearColor = new Color4(1.0, 1.0, 1.0, 1.0); // A darker background for contrast

        const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 150, Vector3.Zero(), scene);
        cameraRef.current = camera;
        camera.layerMask = 0x1FFFFFFF;
        camera.attachControl(canvas, true);
        camera.lowerRadiusLimit = 20;
        camera.upperRadiusLimit = 500;
        camera.wheelDeltaPercentage = 0.01;

        // Add basic lighting for standard materials
        const hemisphericLight = new HemisphericLight("hemisphericLight", new Vector3(0, 1, 0), scene);
        hemisphericLight.intensity = 0.7;
        hemisphericLight.diffuse = new Color3(1, 1, 1);
        hemisphericLight.specular = new Color3(1, 1, 1);

        const directionalLight = new DirectionalLight("directionalLight", new Vector3(-1, -1, -1), scene);
        directionalLight.intensity = 0.8;
        directionalLight.diffuse = new Color3(1, 1, 1);
        directionalLight.specular = new Color3(1, 1, 1);

        if (useAdvancedShaders) {
            const gBuffer = setupGBuffer(scene, engine);
            if (gBuffer) {
                setupAdvancedShaders(scene, camera, gBuffer);
            }
        }

        const onModelLoaded = (loadedModels) => {
            console.log("Model loaded, processing...");
            setIsLoading(false);
            setLoadError(null);
            
            // Clean up any old resources before loading new ones
            cleanupPreviousModel(); 
            modelsRef.current = loadedModels;

            if (loadedModels.allMeshes) {
                loadedModels.allMeshes.forEach((mesh) => {
                    if (!mesh.geometry) return;
                    mesh.setEnabled(true);
                    
                    if (useAdvancedShaders) {
                        mesh.layerMask = 0x20000000;
                    } else {
                        mesh.layerMask = 0x10000000;
                        const material = new StandardMaterial(`basicMat_${mesh.name}`, scene);
                        material.diffuseColor = new Color3(0.9, 0.9, 0.95);
                        material.specularColor = new Color3(0.3, 0.3, 0.3);
                        mesh.material = material;
                    }
                });
            }
            
            guiTextureRef.current = setupGUI({ camera, models: loadedModels, showModel, activeModelRef, onOpenExportDrawer: () => setIsDrawerOpen(true) });
            setIsModelLoaded(true);
            showModel("Full");
        };

        const loaderCleanup = initializeCaseLoader(scene, 'ztcadLoaderInput', onModelLoaded, setIsLoading, setLoadError);

        engine.runRenderLoop(() => { if (scene.isReady()) scene.render(); });
        const handleResize = () => engine.resize();
        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
            loaderCleanup();
            if (engineRef.current) {
                engineRef.current.dispose();
            }
        };
    }, [useAdvancedShaders, cleanupPreviousModel, setupGBuffer, setupAdvancedShaders, showModel]);

    // ... (return statement with JSX remains the same) ...
    return (
        <div style={{ position: 'relative', width: '100%', height: '100vh', backgroundColor: '#f0f0f0' }}>
            <ExportDrawer 
                isOpen={isDrawerOpen} 
                onClose={() => setIsDrawerOpen(false)} 
                onExportGLB={handleExportGLB} 
                onExportSTL={handleExportSTL} 
            />
            
            <input 
                type="file" 
                id="ztcadLoaderInput" 
                accept=".ztcad,.glb" 
                style={{ display: 'none' }} 
            />
            
            {isLoading && (
                <div style={{
                    position: 'absolute', zIndex: 100, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', 
                    background: 'rgba(0,0,0,0.8)', color: 'white', padding: '20px', borderRadius: '8px', textAlign: 'center'
                }}>
                    <div>Loading model...</div>
                    <div style={{ fontSize: '12px', marginTop: '8px', opacity: 0.7 }}>Please wait while the 3D model is processed</div>
                </div>
            )}
            
            {loadError && (
                <div style={{
                    position: 'absolute', zIndex: 100, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', 
                    background: 'rgba(220,20,60,0.95)', color: 'white', padding: '20px', borderRadius: '8px', textAlign: 'center',
                    maxWidth: '400px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>Error</div>
                    <div style={{ fontSize: '14px', marginBottom: '15px' }}>{loadError}</div>
                    <button onClick={() => setLoadError(null)} style={{ background: 'white', color: '#dc143c', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Dismiss</button>
                </div>
            )}
            
            {!isModelLoaded && !isLoading && !loadError && (
                <div style={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 10, textAlign: 'center',
                    background: 'rgba(255,255,255,0.95)', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                    <div style={{ marginBottom: '20px', fontSize: '18px', color: '#333' }}>inbraket Playerviewer</div>
                    <button onClick={() => document.getElementById('ztcadLoaderInput')?.click()} style={{ 
                            background: 'linear-gradient(135deg, #007acc, #005a9e)', color: 'white', border: 'none', borderRadius: '12px', 
                            padding: '15px 25px', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '16px', fontWeight: 'bold',
                            boxShadow: '0 4px 12px rgba(0,122,204,0.3)', transition: 'all 0.2s ease', margin: '0 auto'
                        }} title="Load .ztcad or .glb file"
                        onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,122,204,0.4)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,122,204,0.3)'; }}>
                        <span style={{ marginRight: '10px' }}>🦷</span> Load 3D Model
                    </button>
                    <div style={{ marginTop: '15px', fontSize: '12px', color: '#666' }}>Supports .ztcad and .glb files</div>
                    <div style={{ marginTop: '10px' }}>
                        <label style={{ fontSize: '14px', color: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <input type="checkbox" checked={useAdvancedShaders} onChange={(e) => setUseAdvancedShaders(e.target.checked)} style={{ marginRight: '8px' }} />
                            Enable Angel Align Advanced Shaders
                        </label>
                    </div>
                </div>
            )}

            {isModelLoaded && (
                <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10 }}>
                    <button onClick={() => document.getElementById('ztcadLoaderInput')?.click()} style={{ 
                            background: 'rgba(255,255,255,0.9)', border: '2px solid #007acc', borderRadius: '8px', padding: '10px', cursor: 'pointer', 
                            display: 'flex', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }} title="Load another model">
                        <span style={{ fontSize: '20px' }}>🦷</span>
                    </button>
                </div>
            )}
            
            <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: "100%", height: "100%", outline: 'none', display: 'block' }} />

            {process.env.NODE_ENV === 'development' && (
                <div style={{
                    position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.7)', color: 'white',
                    padding: '8px', borderRadius: '4px', fontSize: '10px', zIndex: 5
                }}>
                    Engine: {engineRef.current ? 'OK' : 'NOT_READY'} | Scene: {sceneRef.current ? 'OK' : 'NOT_READY'} | Model: {isModelLoaded ? 'LOADED' : 'NONE'} | Shaders: {useAdvancedShaders ? 'ADVANCED' : 'BASIC'}
                </div>
            )}
        </div>
    );
};

export default PlayerViewer;