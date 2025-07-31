import { SceneLoader, TransformNode, ShaderMaterial, Effect, Vector4, Constants } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import JSZip from 'jszip';
import { parseShaderFile } from './shaderUtils';
import gBufferShaderCode from '../angel-align/rendering/angel-align-1st-pass-shader.glsl?raw';

const createGBufferMaterial = (scene, geometryType = 0.0) => {
  const parsedShader = parseShaderFile(gBufferShaderCode);
  if (!parsedShader) { 
    console.error("Failed to parse G-Buffer shader");
    return null; 
  }

  const materialName = `gBufferMaterial_${geometryType}`;
  Effect.ShadersStore[`${materialName}VertexShader`] = parsedShader.vertex;
  Effect.ShadersStore[`${materialName}FragmentShader`] = parsedShader.fragment;

  const shaderMaterial = new ShaderMaterial(materialName, scene, {
      vertex: materialName, fragment: materialName
  },
  {
    attributes: ["position", "normal"],
    uniforms: ["world", "view", "worldViewProjection", "GeometryType"],
  });
  
  // Critical fixes for G-Buffer rendering
  shaderMaterial.setFloat("GeometryType", geometryType);
  shaderMaterial.backFaceCulling = false; // Ensure both sides render
  shaderMaterial.alphaMode = Constants.ALPHA_DISABLE; // No transparency in G-Buffer
  shaderMaterial.needDepthPrePass = false;
  
  console.log(`Created G-Buffer material with GeometryType: ${geometryType}`);
  
  return shaderMaterial;
};

const processAndOrganizeMeshes = (meshes, scene) => {
  const allMeshes = meshes.filter(mesh => mesh.geometry);
  const modelRoot = new TransformNode("ModelRoot", scene);
  const groups = {
    Full: new TransformNode("Full", scene),
    Upper: new TransformNode("Upper", scene),
    Lower: new TransformNode("Lower", scene),
    IdealTeeth: new TransformNode("IdealTeeth", scene),
    OriginalTeeth: new TransformNode("OriginalTeeth", scene),
    Brackets: new TransformNode("Brackets", scene),
  };
  Object.values(groups).forEach(group => group.parent = modelRoot);

  const materials = {
    Gums: createGBufferMaterial(scene, 1.0),
    Teeth: createGBufferMaterial(scene, 2.0),
    Brackets: createGBufferMaterial(scene, 3.0),
    Default: createGBufferMaterial(scene, 0.0)
  };

  allMeshes.forEach(mesh => {
    if (!mesh.geometry) return;
    
    mesh.setEnabled(true);
    const name = mesh.name.toLowerCase();
    
    // Assign to appropriate parent group
    if (name.includes('gum') || name.includes('gingiva') || name.includes('tissue')) {
      mesh.parent = name.includes('upper') || name.includes('maxilla') ? groups.Upper : groups.Lower;
    } else if (name.includes('teeth') || name.includes('tooth') || name.includes('crown') || name.includes('incisor') || name.includes('molar') || name.includes('canine')) {
      mesh.parent = name.includes('upper') || name.includes('maxilla') ? groups.Upper : groups.Lower;
    } else if (name.includes('bracket') || name.includes('brace') || name.includes('wire')) {
      mesh.parent = groups.Brackets;
    } else {
      // Default assignment - try to determine if it's upper or lower
      if (name.includes('upper') || name.includes('maxilla')) {
        mesh.parent = groups.Upper;
      } else if (name.includes('lower') || name.includes('mandible')) {
        mesh.parent = groups.Lower;
      } else {
        mesh.parent = groups.Full;
      }
    }
    
    // Assign materials and GeometryType metadata based on mesh type
    if (name.includes('gum') || name.includes('gingiva') || name.includes('tissue')) {
      mesh.material = materials.Gums;
      mesh.metadata = mesh.metadata || {};
      mesh.metadata.GeometryType = 1.0; // Gums geometry type
      console.log(`Assigned gums material to: ${mesh.name} with GeometryType: 1.0`);
    } else if (name.includes('teeth') || name.includes('tooth') || name.includes('crown') || name.includes('incisor') || name.includes('molar') || name.includes('canine')) {
      mesh.material = materials.Teeth;
      mesh.metadata = mesh.metadata || {};
      mesh.metadata.GeometryType = 2.0; // Teeth geometry type
      console.log(`Assigned teeth material to: ${mesh.name} with GeometryType: 2.0`);
    } else if (name.includes('bracket') || name.includes('brace') || name.includes('wire')) {
      mesh.material = materials.Brackets;
      mesh.metadata = mesh.metadata || {};
      mesh.metadata.GeometryType = 3.0; // Brackets geometry type
      console.log(`Assigned brackets material to: ${mesh.name} with GeometryType: 3.0`);
    } else {
      mesh.material = materials.Default;
      mesh.metadata = mesh.metadata || {};
      mesh.metadata.GeometryType = 0.0; // Default geometry type
      console.log(`Assigned default material to: ${mesh.name} with GeometryType: 0.0`);
    }
  });
  return { ...groups, MasterRoot: modelRoot, allMeshes: allMeshes };
};
const loadGlbFromData = async (glbData, scene, onModelLoadedCallback) => {
  try {
    const objectURL = URL.createObjectURL(glbData);
    const result = await SceneLoader.ImportMeshAsync(null, "", objectURL, scene, null, ".glb");
    URL.revokeObjectURL(objectURL);
    const organizedModels = processAndOrganizeMeshes(result.meshes, scene);
    if (onModelLoadedCallback) onModelLoadedCallback(organizedModels);
  } catch (error) {
    console.error("Failed to load GLB data:", error);
    alert(`Error loading GLB data. The file may be corrupt.\nDetails: ${error.message}`);
  }
};
const loadPublishedCase = async (file, scene, onModelLoadedCallback) => {
  try {
    const zip = await JSZip.loadAsync(file);
    const glbEntry = zip.file(/\.glb$/i)[0];
    if (!glbEntry) throw new Error("No .glb file found in archive.");
    const glbBlob = await glbEntry.async('blob');
    await loadGlbFromData(glbBlob, scene, onModelLoadedCallback);
  } catch (error) { console.error("Failed to load published case:", error); alert(`Error loading .ztcad file: ${error.message}`); }
};
const loadModel = async (file, scene, onModelLoadedCallback) => {
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  if (fileExtension === 'ztcad') await loadPublishedCase(file, scene, onModelLoadedCallback);
  else if (fileExtension === 'glb') await loadGlbFromData(file, scene, onModelLoadedCallback);
  else alert('Unsupported file type.');
};
export const initializeCaseLoader = (scene, inputId, onModelLoadedCallback, setLoading, setError) => {
  const fileInput = document.getElementById(inputId);
  if (!fileInput) return () => {};
  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    console.log("=== LOAD 3D MODEL DEBUG ===");
    console.log("File selected:", file.name, "Size:", file.size, "bytes");
    console.log("File type:", file.type);
    console.log("Scene ready:", scene?.isReady());
    console.log("Scene meshes count:", scene?.meshes?.length || 0);
    
    if (setLoading) setLoading(true);
    if (setError) setError(null);
    try { 
      console.log("Starting model load process...");
      await loadModel(file, scene, onModelLoadedCallback); 
      console.log("Model load completed successfully");
    } 
    catch(err) { 
      console.error("Model load failed:", err);
      if (setError) setError(err.message); 
    } 
    finally { 
      if (setLoading) setLoading(false); 
      event.target.value = ''; 
      console.log("=== LOAD 3D MODEL DEBUG END ===");
    }
  };
  fileInput.addEventListener('change', handleFileChange);
  return () => fileInput.removeEventListener('change', handleFileChange);
};
