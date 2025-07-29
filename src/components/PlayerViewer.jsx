// --- ENHANCED PlayerViewer.jsx with GUI and Shaders ---

import React, { useEffect, useRef, useCallback, useState } from "react";
import { setupGUI } from "./GUIControls"; // Your GUI controller
import { initializeCaseLoader } from "./ModelLoader";
import { exportToGLB, exportToSTL } from "./Exporter";
import ExportDrawer from "./ExportDrawer";
import { 
    Engine, Scene, Vector3, ArcRotateCamera, HemisphericLight, 
    DirectionalLight, Color4, StandardMaterial, Color3, 
    MultiRenderTarget, Constants, PostProcess, Effect, Texture
} from "@babylonjs/core";

// Import your shaders
import gumsRenderShader from '../angel-align/rendering/gums-render-pass.glsl?raw';

const PlayerViewer = () => {
    const canvasRef = useRef(null);
    const engineRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const modelsRef = useRef(null);
    const activeModelRef = useRef(null);
    const guiTextureRef = useRef(null);
    
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const [useAdvancedShaders, setUseAdvancedShaders] = useState(false);

    // Setup shader effects
    useEffect(() => {
        if (gumsRenderShader) {
            Effect.ShadersStore["gumsRenderFragmentShader"] = gumsRenderShader;
            console.log("Gums render shader loaded successfully");
        } else {
            console.error("The 'gums-render-pass.glsl' file could not be loaded!");
        }
    }, []);

    const cleanupPreviousModel = useCallback(() => {
        if (guiTextureRef.current) { 
            guiTextureRef.current.dispose(); 
            guiTextureRef.current = null; 
        }
        if (modelsRef.current?.MasterRoot) { 
            modelsRef.current.MasterRoot.dispose(false, true); 
        }
        modelsRef.current = null;
        activeModelRef.current = null;
        setIsModelLoaded(false);
    }, []);

    const showModel = useCallback((type) => {
        const models = modelsRef.current;
        const camera = cameraRef.current;
        if (!models || !camera) {
            console.log("No models or camera available");
            return;
        }

        console.log("Showing model type:", type, "Available models:", Object.keys(models));

        // Hide all model groups first
        Object.keys(models).forEach(key => {
            if (models[key]?.setEnabled && key !== 'MasterRoot' && key !== 'allMeshes') {
                models[key].setEnabled(false);
            }
        });

        let targetModel = models.Full || models.MasterRoot;
        
        // Show specific model parts
        if (type === 'Upper' && models.Upper) {
            models.Upper.setEnabled(true);
            targetModel = models.Upper;
        } else if (type === 'Lower' && models.Lower) {
            models.Lower.setEnabled(true);
            targetModel = models.Lower;
        } else if (type === 'Full') {
            // Show all available model parts
            ['Upper', 'Lower', 'IdealTeeth', 'OriginalTeeth', 'Brackets', 'Full'].forEach(key => {
                if (models[key]?.setEnabled) {
                    models[key].setEnabled(true);
                }
            });
            targetModel = models.MasterRoot || models.Full;
        }

        activeModelRef.current = targetModel;

        // Position camera to view the model
        if (targetModel && camera) {
            setTimeout(() => {
                try {
                    // Get bounding info for better camera positioning
                    const boundingInfo = targetModel.getBoundingInfo ? 
                        targetModel.getBoundingInfo() : 
                        { boundingBox: { minimumWorld: new Vector3(-50, -50, -50), maximumWorld: new Vector3(50, 50, 50) } };
                    
                    const center = boundingInfo.boundingBox.centerWorld || Vector3.Zero();
                    const size = boundingInfo.boundingBox.maximumWorld.subtract(boundingInfo.boundingBox.minimumWorld);
                    const maxSize = Math.max(size.x, size.y, size.z);
                    
                    const distance = maxSize * 2;
                    camera.setPosition(new Vector3(distance, distance * 0.5, distance));
                    camera.setTarget(center);
                    
                    console.log("Camera positioned - Center:", center, "Distance:", distance);
                } catch (error) { 
                    console.error("Camera positioning error:", error);
                    // Fallback positioning
                    camera.setPosition(new Vector3(100, 50, 100));
                    camera.setTarget(Vector3.Zero());
                }
            }, 100);
        }
    }, []);

    const handleExport = useCallback((exportFunction) => {
        if (!sceneRef.current || !modelsRef.current) { 
            console.log("No scene or models available for export");
            return; 
        }
        
        let meshesToExport = [];
        const groups = ['Upper', 'Lower', 'IdealTeeth', 'OriginalTeeth', 'Brackets', 'Full'];
        
        groups.forEach(name => {
            if (modelsRef.current[name]) {
                const childMeshes = modelsRef.current[name].getChildMeshes(false);
                meshesToExport.push(...childMeshes);
            }
        });
        
        if (meshesToExport.length > 0) { 
            exportFunction(meshesToExport); 
            console.log(`Exporting ${meshesToExport.length} meshes`);
        } else {
            console.warn("No meshes found to export");
        }
        setIsDrawerOpen(false);
    }, []);

    const handleExportGLB = useCallback(() => {
        handleExport(meshes => exportToGLB(sceneRef.current, meshes, "exported_model.glb"));
    }, [handleExport]);

    const handleExportSTL = useCallback(() => {
        handleExport(meshes => exportToSTL(sceneRef.current, meshes, "exported_model.stl"));
    }, [handleExport]);

    // Create G-Buffer for advanced rendering
    const setupGBuffer = useCallback((scene, engine) => {
        try {
            const canvas = canvasRef.current;
            if (!canvas) return null;

            const renderWidth = Math.max(canvas.clientWidth, 800);
            const renderHeight = Math.max(canvas.clientHeight, 600);
            
            console.log("Creating G-Buffer with dimensions:", renderWidth, "x", renderHeight);
            
            const gBuffer = new MultiRenderTarget("gBuffer", 
                { width: renderWidth, height: renderHeight }, 
                3, 
                scene, 
                {
                    generateMipMaps: false,
                    generateDepthBuffer: true,
                    types: [
                        Constants.TEXTURETYPE_FLOAT, 
                        Constants.TEXTURETYPE_FLOAT, 
                        Constants.TEXTURETYPE_FLOAT
                    ],
                    samplingModes: [
                        Constants.TEXTURE_NEAREST_SAMPLINGMODE, 
                        Constants.TEXTURE_NEAREST_SAMPLINGMODE, 
                        Constants.TEXTURE_NEAREST_SAMPLINGMODE
                    ]
                }
            );
            
            scene.gBuffer = gBuffer;
            
            gBuffer.onBeforeRenderObservable.add(() => {
                engine.clear(new Color4(0, 0, 0, 0), true, true, true);
            });
            
            scene.customRenderTargets.push(gBuffer);
            console.log("G-Buffer created successfully");
            
            return gBuffer;
        } catch (error) {
            console.warn("Failed to create G-Buffer:", error);
            return null;
        }
    }, []);

    // Setup advanced shader post-processing
    const setupAdvancedShaders = useCallback((scene, camera, gBuffer) => {
        if (!gBuffer || !Effect.ShadersStore["gumsRenderFragmentShader"]) {
            console.warn("Cannot setup advanced shaders - missing G-Buffer or shader");
            return null;
        }

        try {
            console.log("Setting up advanced gums shader...");
            
            const ASSET_PATH = "/assets/";
            
            // Load textures with error handling
            const loadTexture = (path) => {
                try {
                    const texture = new Texture(ASSET_PATH + path, scene);
                    console.log(`Loaded texture: ${path}`);
                    return texture;
                } catch (error) {
                    console.warn(`Failed to load texture: ${path}`, error);
                    return null;
                }
            };

            const gumDiffuseTex = loadTexture("angel-align-texture-gums-diffuse.png");
            const gumReflectTex = loadTexture("angel-align-texture-reflection.png");
            const gumSpecularTex = loadTexture("angel-align-6th-pass-step-2-gums-texture-specular.png");
            const gumNormalTex = loadTexture("angel-align-texture-gums-normal.png");

            const gumsPass = new PostProcess("gumsRender", "gumsRender",
                ["diffuse", "opacity", "ambientLightColor", "selfIllumination", "glossiness", "reflectivity", "shineFactor", "enableTexture",
                 "pointLights[0].position", "pointLights[0].color", "pointLights[1].position", "pointLights[1].color",
                 "pointLights[2].position", "pointLights[2].color"],
                ["gBufferPosition", "gBufferNormal", "gBufferData", "diffuseMap", "reflectMap", "specularMap", "normalMap"],
                1.0, camera
            );

            const pointLights = [
                { position: new Vector3(100, 200, -150), color: new Color3(0.9, 0.8, 0.7) },
                { position: new Vector3(-80, -100, 100), color: new Color3(0.5, 0.5, 0.8) },
                { position: new Vector3(0, -150, -100), color: new Color3(0.4, 0.4, 0.4) },
            ];

            gumsPass.onApply = (effect) => {
                try {
                    effect.setTexture("gBufferPosition", gBuffer.textures[0]);
                    effect.setTexture("gBufferNormal", gBuffer.textures[1]);
                    effect.setTexture("gBufferData", gBuffer.textures[2]);
                    
                    if (gumDiffuseTex) effect.setTexture("diffuseMap", gumDiffuseTex);
                    if (gumReflectTex) effect.setTexture("reflectMap", gumReflectTex);
                    if (gumSpecularTex) effect.setTexture("specularMap", gumSpecularTex);
                    if (gumNormalTex) effect.setTexture("normalMap", gumNormalTex);
                    
                    effect.setFloat("opacity", 1.0);
                    effect.setVector3("diffuse", new Vector3(1.0, 1.0, 1.0));
                    effect.setVector3("ambientLightColor", new Vector3(0.2, 0.2, 0.25));
                    effect.setFloat("selfIllumination", 0.0);
                    effect.setFloat("glossiness", 0.3);
                    effect.setFloat("reflectivity", 0.4);
                    effect.setFloat("shineFactor", 0.8);
                    effect.setFloat("enableTexture", 1.0);

                    pointLights.forEach((light, i) => {
                        effect.setVector3(`pointLights[${i}].position`, light.position);
                        effect.setVector3(`pointLights[${i}].color`, light.color);
                    });
                } catch (error) {
                    console.error("Error in gumsPass.onApply:", error);
                }
            };

            console.log("Advanced gums shader setup complete");
            return gumsPass;
        } catch (error) {
            console.error("Error setting up advanced shaders:", error);
            return null;
        }
    }, []);

    // Initialize Babylon.js scene
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            console.error("Canvas not found");
            return;
        }

        console.log("Initializing Babylon.js with advanced features...");

        try {
            // Create engine
            const engine = new Engine(canvas, true, {
                antialias: true,
                stencil: true,
                preserveDrawingBuffer: false
            });
            engineRef.current = engine;
            console.log("Engine created, WebGL version:", engine.webGLVersion);

            // Create scene
            const scene = new Scene(engine);
            sceneRef.current = scene;
            scene.clearColor = new Color4(0.94, 0.94, 1.0, 1.0); // Light blue background
            console.log("Scene created");

            // Create camera
            const camera = new ArcRotateCamera(
                "camera", 
                -Math.PI / 2, 
                Math.PI / 2.5, 
                150, 
                Vector3.Zero(), 
                scene
            );
            camera.attachControl(canvas, true);
            camera.lowerRadiusLimit = 20;
            camera.upperRadiusLimit = 500;
            camera.wheelDeltaPercentage = 0.01;
            cameraRef.current = camera;
            console.log("Camera created");

            // Add lighting
            const ambientLight = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene);
            ambientLight.intensity = 0.7;

            const directionalLight = new DirectionalLight("main", new Vector3(-1, -1, -1), scene);
            directionalLight.intensity = 0.8;
            directionalLight.position = new Vector3(20, 40, 20);
            console.log("Lighting setup complete");

            // Setup G-Buffer for advanced rendering
            let gBuffer = null;
            let advancedShaderPass = null;
            
            if (useAdvancedShaders) {
                gBuffer = setupGBuffer(scene, engine);
                if (gBuffer) {
                    advancedShaderPass = setupAdvancedShaders(scene, camera, gBuffer);
                }
            }

            // Model loading callback
            const onModelLoaded = (loadedModels) => {
                console.log("Model loaded callback triggered", loadedModels);
                setLoadError(null);
                setIsLoading(false);
                
                try {
                    cleanupPreviousModel();
                    modelsRef.current = loadedModels;

                    // Apply materials based on whether we're using advanced shaders
                    if (loadedModels.allMeshes) {
                        loadedModels.allMeshes.forEach((mesh, index) => {
                            if (mesh.geometry) {
                                // Enable the mesh
                                mesh.setEnabled(true);
                                
                                // Apply material if needed
                                if (!mesh.material || !useAdvancedShaders) {
                                    const material = new StandardMaterial(`basicMat_${index}`, scene);
                                    material.diffuseColor = new Color3(0.9, 0.9, 0.95);
                                    material.specularColor = new Color3(0.3, 0.3, 0.3);
                                    mesh.material = material;
                                }
                                
                                console.log(`Mesh ${index} (${mesh.name}) processed`);
                            }
                        });
                    }

                    // Setup GUI with your controller
                    try {
                        console.log("Setting up GUI...");
                        guiTextureRef.current = setupGUI({
                            camera, 
                            models: loadedModels, 
                            showModel,
                            activeModelRef, 
                            onOpenExportDrawer: () => setIsDrawerOpen(true),
                            // Add any additional parameters your GUI needs
                            scene: scene,
                            engine: engine,
                            useAdvancedShaders: useAdvancedShaders,
                            setUseAdvancedShaders: setUseAdvancedShaders
                        });
                        console.log("GUI setup complete");
                    } catch (guiError) {
                        console.warn("GUI setup failed:", guiError);
                    }
                    
                    setIsModelLoaded(true);
                    showModel("Full");
                    
                    console.log("Model processing completed");
                } catch (error) {
                    console.error("Error processing loaded model:", error);
                    setLoadError("Failed to process model: " + error.message);
                }
            };

            // Initialize file loader
            const loaderCleanup = initializeCaseLoader(
                scene, 
                'ztcadLoaderInput', 
                onModelLoaded, 
                setIsLoading, 
                setLoadError
            );

            // Start render loop
            console.log("Starting render loop...");
            engine.runRenderLoop(() => {
                if (scene && !scene.isDisposed) {
                    scene.render();
                }
            });

            // Handle window resize
            const handleResize = () => {
                if (engine && !engine.isDisposed) {
                    engine.resize();
                    // Resize G-Buffer if it exists
                    if (gBuffer) {
                        try {
                            const newWidth = Math.max(canvas.clientWidth, 800);
                            const newHeight = Math.max(canvas.clientHeight, 600);
                            gBuffer.resize({ width: newWidth, height: newHeight });
                        } catch (error) {
                            console.warn("Failed to resize G-Buffer:", error);
                        }
                    }
                }
            };
            window.addEventListener("resize", handleResize);

            console.log("Babylon.js initialization completed successfully");

            // Cleanup function
            return () => {
                console.log("Cleaning up Babylon.js...");
                window.removeEventListener("resize", handleResize);
                if (loaderCleanup) loaderCleanup();
                cleanupPreviousModel();
                if (advancedShaderPass) advancedShaderPass.dispose();
                if (gBuffer) gBuffer.dispose();
                if (engine && !engine.isDisposed) {
                    engine.dispose();
                }
            };

        } catch (error) {
            console.error("Critical error during Babylon.js initialization:", error);
            setLoadError("Failed to initialize 3D engine: " + error.message);
        }
    }, [cleanupPreviousModel, showModel, useAdvancedShaders, setupGBuffer, setupAdvancedShaders]);

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
                    position: 'absolute', 
                    zIndex: 100, 
                    top: '50%', 
                    left: '50%', 
                    transform: 'translate(-50%,-50%)', 
                    background: 'rgba(0,0,0,0.8)', 
                    color: 'white', 
                    padding: '20px', 
                    borderRadius: '8px',
                    textAlign: 'center'
                }}>
                    <div>Loading model...</div>
                    <div style={{ fontSize: '12px', marginTop: '8px', opacity: 0.7 }}>
                        Please wait while the 3D model is processed
                    </div>
                </div>
            )}
            
            {loadError && (
                <div style={{
                    position: 'absolute', 
                    zIndex: 100, 
                    top: '50%', 
                    left: '50%', 
                    transform: 'translate(-50%,-50%)', 
                    background: 'rgba(220,20,60,0.95)', 
                    color: 'white', 
                    padding: '20px', 
                    borderRadius: '8px', 
                    textAlign: 'center',
                    maxWidth: '400px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>Error</div>
                    <div style={{ fontSize: '14px', marginBottom: '15px' }}>{loadError}</div>
                    <button 
                        onClick={() => setLoadError(null)}
                        style={{
                            background: 'white',
                            color: '#dc143c',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        Dismiss
                    </button>
                </div>
            )}
            
            {!isModelLoaded && !isLoading && !loadError && (
                <div style={{
                    position: 'absolute', 
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%,-50%)',
                    zIndex: 10,
                    textAlign: 'center',
                    background: 'rgba(255,255,255,0.95)',
                    padding: '30px',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                    <div style={{ marginBottom: '20px', fontSize: '18px', color: '#333' }}>
                        inbraket Playerviewer
                    </div>
                    <button 
                        onClick={() => document.getElementById('ztcadLoaderInput')?.click()} 
                        style={{ 
                            background: 'linear-gradient(135deg, #007acc, #005a9e)', 
                            color: 'white',
                            border: 'none', 
                            borderRadius: '12px', 
                            padding: '15px 25px', 
                            cursor: 'pointer', 
                            display: 'flex',
                            alignItems: 'center',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            boxShadow: '0 4px 12px rgba(0,122,204,0.3)',
                            transition: 'all 0.2s ease',
                            margin: '0 auto'
                        }} 
                        title="Load .ztcad or .glb file"
                        onMouseOver={(e) => {
                            e.target.style.transform = 'translateY(-2px)';
                            e.target.style.boxShadow = '0 6px 16px rgba(0,122,204,0.4)';
                        }}
                        onMouseOut={(e) => {
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = '0 4px 12px rgba(0,122,204,0.3)';
                        }}
                    >
                        <span style={{ marginRight: '10px' }}>🦷</span>
                        Load 3d Model
                    </button>
                    <div style={{ marginTop: '15px', fontSize: '12px', color: '#666' }}>
                        Supports .ztcad and .glb files
                    </div>
                    <div style={{ marginTop: '10px' }}>
                        <label style={{ fontSize: '14px', color: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <input 
                                type="checkbox" 
                                checked={useAdvancedShaders}
                                onChange={(e) => setUseAdvancedShaders(e.target.checked)}
                                style={{ marginRight: '8px' }}
                            />
                            Enable Angel Align Advanced Shaders
                        </label>
                    </div>
                </div>
            )}

            {/* Load button in corner when model is loaded */}
            {isModelLoaded && (
                <div style={{
                    position: 'absolute', 
                    top: 20, 
                    left: 20, 
                    zIndex: 10
                }}>
                    <button 
                        onClick={() => document.getElementById('ztcadLoaderInput')?.click()} 
                        style={{ 
                            background: 'rgba(255,255,255,0.9)', 
                            border: '2px solid #007acc', 
                            borderRadius: '8px', 
                            padding: '10px', 
                            cursor: 'pointer', 
                            display: 'flex',
                            alignItems: 'center',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }} 
                        title="Load another model"
                    >
                        <span style={{ fontSize: '20px' }}>🦷</span>
                    </button>
                </div>
            )}
            
            <canvas 
                ref={canvasRef} 
                style={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    width: "100%", 
                    height: "100%", 
                    outline: 'none',
                    display: 'block'
                }} 
            />

            {/* Debug info */}
            {process.env.NODE_ENV === 'development' && (
                <div style={{
                    position: 'absolute',
                    bottom: 10,
                    right: 10,
                    background: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    padding: '8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    zIndex: 5
                }}>
                    Engine: {engineRef.current ? 'OK' : 'NOT_READY'} |{' '}
                    Scene: {sceneRef.current ? 'OK' : 'NOT_READY'} |{' '}
                    Model: {isModelLoaded ? 'LOADED' : 'NONE'} |{' '}
                    Shaders: {useAdvancedShaders ? 'ADVANCED' : 'BASIC'}
                </div>
            )}
        </div>
    );
};

export default PlayerViewer;