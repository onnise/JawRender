// This is the code for the ADVANCED GUI with image buttons and sliders.

import {
  AdvancedDynamicTexture,
  Button,
  StackPanel,
  Control,
  Slider,
  TextBlock,
  Image,
} from "@babylonjs/gui";
import { Vector3 } from "@babylonjs/core";

// --- STYLING FUNCTIONS (HELPER LOGIC) ---
const styleImageButton = (btn) => {
  btn.width = "35px";
  btn.height = "35px";
  btn.thickness = 0;
  btn.background = "gray";
  if (btn.image) btn.image.stretch = Image.STRETCH_UNIFORM;
  btn.cornerRadius = 8;
};

const setSelected = (btn, selectionRef) => {
  if (selectionRef.current) selectionRef.current.background = "gray";
  btn.background = "black";
  selectionRef.current = btn;
};

// --- MAIN GUI SETUP FUNCTION ---
export const setupGUI = ({ camera, models, showModel, activeModelRef, onNavigateToConverter }) => {
  const gui = AdvancedDynamicTexture.CreateFullscreenUI("UI", true);

  const jawSelection = { current: null };
  const viewSelection = { current: null };

  const topPanel = new StackPanel();
  topPanel.isVertical = false;
  topPanel.height = "60px";
  topPanel.top = "80px";
  topPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  topPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  topPanel.spacing = 10;
  gui.addControl(topPanel);

  const rightPanel = new StackPanel();
  rightPanel.isVertical = true;
  rightPanel.width = "200px";
  rightPanel.right = "30px";
  rightPanel.top = "80px";
  rightPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  rightPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  rightPanel.spacing = 5;
  gui.addControl(rightPanel);

  ["Upper", "Lower", "Full"].forEach((type) => {
    const btn = Button.CreateImageOnlyButton(`${type}Btn`, `/assets/${type.toLowerCase()}.png`);
    styleImageButton(btn);
    btn.tooltipText = `${type} Jaw`;
    btn.onPointerUpObservable.add(() => {
      showModel(type);
      setSelected(btn, jawSelection);
    });
    topPanel.addControl(btn);
  });

  const views = [
    { label: "Top", position: new Vector3(0, 150, 0) },
    { label: "Bottom", position: new Vector3(0, -150, 0) },
    { label: "Front", position: new Vector3(0, 0, 150) },
    { label: "Back", position: new Vector3(0, 0, -150) },
    { label: "Left", position: new Vector3(-150, 0, 0) },
    { label: "Right", position: new Vector3(150, 0, 0) },
  ];
  views.forEach(({ label, position }) => {
    const btn = Button.CreateImageOnlyButton(`${label}ViewBtn`, `/assets/${label.toLowerCase()}.png`);
    styleImageButton(btn);
    btn.tooltipText = `${label} View`;
    btn.onPointerUpObservable.add(() => {
      camera.setPosition(position);
      camera.setTarget(activeModelRef.current?.position || Vector3.Zero());
      setSelected(btn, viewSelection);
    });
    topPanel.addControl(btn);
  });

  const createTransparencySlider = (labelText, modelKey) => {
    const container = new StackPanel();
    container.isVertical = false;
    container.height = "30px";
    rightPanel.addControl(container);

    const label = new TextBlock(`${labelText}Label`, labelText);
    label.width = "80px";
    label.color = "white";
    label.fontSize = 14;
    container.addControl(label);

    const slider = new Slider();
    slider.minimum = 0;
    slider.maximum = 1;
    slider.value = 1;
    slider.height = "20px";
    slider.width = "100px";
    slider.color = "#008CBA";
    slider.background = "#ddd";
    container.addControl(slider);
    
    slider.onValueChangedObservable.add((value) => {
      const modelGroup = models[modelKey];
      if (modelGroup) {
        modelGroup.getChildMeshes(true).forEach(mesh => {
            if (mesh.material) mesh.material.alpha = value;
        });
      }
    });
  };
  createTransparencySlider("Upper Jaw:", "Upper");
  createTransparencySlider("Lower Jaw:", "Lower");

  const converterButton = Button.CreateImageOnlyButton("converterBtn", "/assets/tcad_converter.png");
  styleImageButton(converterButton);
  converterButton.tooltipText = "Go to Converter Workspace";
  converterButton.onPointerUpObservable.add(() => {
    if (onNavigateToConverter) onNavigateToConverter();
  });
  rightPanel.addControl(converterButton);

  return gui;
};