import { SceneLoader, TransformNode, ShaderMaterial, Effect, Vector4 } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import JSZip from 'jszip';
import { parseShaderFile } from './shaderUtils';
import gBufferShaderCode from '../angel-align/rendering/angel-align-1st-pass-shader.glsl?raw';

const createGBufferMaterial = (scene) => {
  const parsedShader = parseShaderFile(gBufferShaderCode);
  if (!parsedShader) { return null; }

  Effect.ShadersStore["gBufferVertexShader"] = parsedShader.vertex;
  Effect.ShadersStore["gBufferFragmentShader"] = parsedShader.fragment;

  const shaderMaterial = new ShaderMaterial("gBufferMaterial", scene, {
      vertex: "gBuffer", fragment: "gBuffer"
  },
  {
    attributes: ["position", "normal"],
    // UNIFORM LIST IS NOW SIMPLE AND STANDARD!
    uniforms: ["world", "view", "worldViewProjection", "GeometryType"],
  });
  
  // THE FRAGILE onBind FUNCTION IS GONE!
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
    Gums: createGBufferMaterial(scene),
    Teeth: createGBufferMaterial(scene),
    Brackets: createGBufferMaterial(scene),
    Default: createGBufferMaterial(scene)
  };

  if (materials.Gums) materials.Gums.setFloat("GeometryType", 1.0);
  if (materials.Teeth) materials.Teeth.setFloat("GeometryType", 2.0);
  if (materials.Brackets) materials.Brackets.setFloat("GeometryType", 3.0);

  allMeshes.forEach(mesh => {
    mesh.setEnabled(true);
    const name = mesh.name.toLowerCase();
    
    if (name.includes('upper') || name.includes('maxilla') || name.includes('gumu')) {
      mesh.parent = groups.Upper; mesh.material = materials.Gums;
    } else if (name.includes('lower') || name.includes('mandible') || name.includes('guml')) {
      mesh.parent = groups.Lower; mesh.material = materials.Gums; // Gums can be lower too
    } else if (name.includes('teeth')) { // Simple check for teeth
      mesh.parent = groups.IdealTeeth; mesh.material = materials.Teeth;
    } else {
      mesh.parent = groups.Full; mesh.material = materials.Default;
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
    if (setLoading) setLoading(true);
    if (setError) setError(null);
    try { await loadModel(file, scene, onModelLoadedCallback); } 
    catch(err) { if (setError) setError(err.message); } 
    finally { if (setLoading) setLoading(false); event.target.value = ''; }
  };
  fileInput.addEventListener('change', handleFileChange);
  return () => fileInput.removeEventListener('change', handleFileChange);
};