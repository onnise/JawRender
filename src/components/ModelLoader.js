// --- START OF FILE ModelLoader.js ---

import {
  SceneLoader,
  TransformNode,
  ShaderMaterial,
  Effect,
  Vector4,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import JSZip from 'jszip';
import { parseShaderFile } from './shaderUtils'; // You must have this utility file
import gBufferShaderCode from '../angel-align/rendering/angel-align-1st-pass-shader.glsl?raw'; // Ensure this path is correct

// This function creates the material for your actual G-Buffer shader
const createGBufferMaterial = (scene) => {
  console.log("--- Creating REAL G-Buffer Material from external GLSL file ---");
  const parsedShader = parseShaderFile(gBufferShaderCode);
  if (!parsedShader) {
    console.error("Failed to parse G-Buffer shader.");
    return null;
  }

  Effect.ShadersStore["gBufferVertexShader"] = parsedShader.vertex;
  Effect.ShadersStore["gBufferFragmentShader"] = parsedShader.fragment;

  const shaderMaterial = new ShaderMaterial("gBufferMaterial", scene, {
      vertex: "gBuffer",
      fragment: "gBuffer"
  },
  {
    attributes: ["position", "normal"],
    // We MUST declare EVERY uniform that your GLSL shader expects by its exact name
    uniforms: [
        "world", "worldView", "worldViewProjection", // Standard Babylon matrices
        "ModelMatrix", "ModelViewMatrix", "NormalMatrix", "MVP", // YOUR custom uniforms
        "GeometryType", "EnableClipPlane", "ClipPlane"
    ],
  });

  // THE "GLUE": This function manually links Babylon's matrices to your shader's custom names
  shaderMaterial.onBind = (mesh) => {
      const effect = shaderMaterial.getEffect();
      if (!effect) return;

      const worldMatrix = mesh.getWorldMatrix();
      
      effect.setMatrix("ModelMatrix", worldMatrix);
      effect.setMatrix("ModelViewMatrix", worldMatrix.multiply(scene.getViewMatrix()));
      effect.setMatrix("MVP", worldMatrix.multiply(scene.getTransformMatrix()));
      
      const normalMatrix = worldMatrix.clone().invert().transpose();
      // effect.setMatrix3x3("NormalMatrix", normalMatrix);
       effect.setMatrix("NormalMatrix", normalMatrix);
      //  effect.setMatrix3x3FromMat4("NormalMatrix", normalMatrix);
      
  };
  
  return shaderMaterial;
};

// Your original working logic for processing meshes, now using the real G-Buffer material
const processAndOrganizeMeshes = (meshes, scene) => {
  const allMeshes = meshes.filter(mesh => mesh.geometry);
  const modelRoot = new TransformNode("ModelRoot", scene);
  
  const groups = {
    Full: new TransformNode("FullModelGroup", scene),
    Upper: new TransformNode("UpperJawGroup", scene),
    Lower: new TransformNode("LowerJawGroup", scene),
    IdealTeeth: new TransformNode("IdealTeethGroup", scene),
    OriginalTeeth: new TransformNode("OriginalTeethGroup", scene),
    Brackets: new TransformNode("BracketsGroup", scene),
  };
  Object.values(groups).forEach(group => group.parent = modelRoot);

  const materials = {
    Gums: createGBufferMaterial(scene),
    Teeth: createGBufferMaterial(scene),
    Brackets: createGBufferMaterial(scene),
    Default: createGBufferMaterial(scene)
  };

  // Set the specific GeometryType ID for each material instance
  if (materials.Gums) materials.Gums.setFloat("GeometryType", 1.0);
  if (materials.Teeth) materials.Teeth.setFloat("GeometryType", 2.0);
  if (materials.Brackets) materials.Brackets.setFloat("GeometryType", 3.0);
  if (materials.Default) materials.Default.setFloat("GeometryType", 0.0);

  // Initialize common properties for all materials
  Object.values(materials).forEach(mat => {
      if (mat) {
           mat.setFloat("EnableClipPlane", 0.0);
          mat.setVector4("ClipPlane", Vector4.Zero());
          mat.backFaceCulling = false;
      }
  });

  allMeshes.forEach(mesh => {
    mesh.setEnabled(true);
    mesh.isVisible = true;
    const name = mesh.name.toLowerCase();
    
    // Assign mesh to a group and give it the group's material instance
    if (name.includes('ideal') || name.includes('target') || name.includes('original') || name.includes('initial')) {
      mesh.parent = groups.IdealTeeth;
      mesh.material = materials.Teeth;
    } else if (name.includes('bracket') || name.includes('brace') || name.includes('wire')) {
      mesh.parent = groups.Brackets;
      mesh.material = materials.Brackets;
    } else if (name.includes('upper') || name.includes('maxilla') || name.includes('gumu') || name.includes('teethu') || name.includes('max')) {
      mesh.parent = groups.Upper;
      mesh.material = materials.Gums;
    } else if (name.includes('lower') || name.includes('mandible') || name.includes('guml') || name.includes('teethl') || name.includes('mand')) {
      mesh.parent = groups.Lower;
      mesh.material = materials.Gums;
    } else {
      mesh.parent = groups.Full;
      mesh.material = materials.Default;
    }
  });

  return { ...groups, MasterRoot: modelRoot };
};


// Your file loading functions (unchanged from your original working file)
const loadGlbFromData = async (glbData, scene, onModelLoadedCallback) => {
  try {
    const objectURL = URL.createObjectURL(glbData);
    const result = await SceneLoader.ImportMeshAsync(null, "", objectURL, scene, null, ".glb");
    URL.revokeObjectURL(objectURL);
    const organizedModels = processAndOrganizeMeshes(result.meshes, scene);
    if (onModelLoadedCallback) onModelLoadedCallback(organizedModels);
  } catch (error) { console.error("Failed to load GLB data:", error); alert(`Error loading GLB data: ${error.message}`); }
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
  if (fileExtension === 'ztcad') { await loadPublishedCase(file, scene, onModelLoadedCallback); }
  else if (fileExtension === 'glb') { await loadGlbFromData(file, scene, onModelLoadedCallback); }
  else { alert('Unsupported file type.'); }
};
export const initializeCaseLoader = (scene, inputId, onModelLoadedCallback, setLoading, setError) => {
  const fileInput = document.getElementById(inputId);
  if (!fileInput) return () => {};
  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if(setLoading) setLoading(true); 
    if(setError) setError(null);
    try { await loadModel(file, scene, onModelLoadedCallback); } 
    catch(err) { if(setError) setError(err.message); } 
    finally { if(setLoading) setLoading(false); event.target.value = ''; }
  };
  fileInput.addEventListener('change', handleFileChange);
  return () => fileInput.removeEventListener('change', handleFileChange);
};