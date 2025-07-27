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

export const setupGUI = ({ camera, models, showModel, activeModelRef, onOpenExportDrawer }) => {
    const gui = AdvancedDynamicTexture.CreateFullscreenUI("UI");

    const topPanel = new StackPanel();
    topPanel.isVertical = false;
    topPanel.height = "60px";
    topPanel.top = "20px";
    topPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    topPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    topPanel.spacing = 10;
    gui.addControl(topPanel);

    const rightPanel = new StackPanel();
    rightPanel.isVertical = true;
    rightPanel.width = "200px";
    rightPanel.right = "80px";
    rightPanel.top = "80px";
    rightPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    rightPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    rightPanel.spacing = 5;
    gui.addControl(rightPanel);

    const jawSelection = { current: null };
    const viewSelection = { current: null };

    ["Upper", "Lower", "Full"].forEach((type) => {
        const btn = Button.CreateImageOnlyButton(
            `${type}Btn`,
            `/assets/${type.toLowerCase()}.png`
        );
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
        const btn = Button.CreateImageOnlyButton(
            `${label}ViewBtn`,
            `/assets/${label.toLowerCase()}.png`
        );
        styleImageButton(btn);
        btn.tooltipText = `${label} View`;
        btn.onPointerUpObservable.add(() => {
            camera.setPosition(position);
            camera.setTarget(activeModelRef.current?.position || Vector3.Zero());
            setSelected(btn, viewSelection);
        });
        topPanel.addControl(btn);
    });

    // --- CORRECTED SLIDER CREATION IS HERE ---
    if (models) {
        const createTransparencySlider = (labelText, modelKey) => {
            const modelGroup = models[modelKey];
            // Only create a slider if the corresponding group actually has meshes in it.
            if (!modelGroup || modelGroup.getChildMeshes(true).length === 0) {
                return; // Don't create a slider for an empty group.
            }

            const container = new StackPanel();
            container.isVertical = false;
            container.height = "30px";
            rightPanel.addControl(container);

            const label = new TextBlock();
            label.text = labelText;
            label.width = "80px";
            label.color = "black";
            label.fontSize = 14;
            container.addControl(label);

            const slider = new Slider();
            slider.minimum = 0;
            slider.maximum = 255;
            slider.value = 255;
            slider.height = "20px";
            slider.width = "100px";
            slider.color = "#ADD8E6";
            slider.background = "#ddd";
            container.addControl(slider);

            const valueLabel = new TextBlock();
            valueLabel.text = "255";
            valueLabel.width = "30px";
            valueLabel.color = "black";
            valueLabel.fontSize = 14;
            container.addControl(valueLabel);

            // Since all meshes in this group share one material, we only need to set it once.
            const firstMesh = modelGroup.getChildMeshes(true)[0];
            const materialToControl = firstMesh.material;

            slider.onValueChangedObservable.add((value) => {
                if (materialToControl) {
                    materialToControl.setFloat("alpha", value / 255.0);
                    materialToControl.alpha = value / 255.0; // Ensure both properties are set
                }
                valueLabel.text = value.toFixed(0);
            });
        };

        // +++ ADDED: Call the function to create sliders for the Upper and Lower jaws +++
        createTransparencySlider("Upper Jaw", "Upper");
        createTransparencySlider("Lower Jaw", "Lower");

        // Original sliders still work if those groups exist
        createTransparencySlider("Ideal Teeth", "IdealTeeth");
        createTransparencySlider("Original Teeth", "OriginalTeeth");
        createTransparencySlider("Brackets", "Brackets");
    }

    const leftPanel = new StackPanel();
    leftPanel.isVertical = true;
    leftPanel.width = "50px";
    leftPanel.left = "80px";
    leftPanel.top = "10px";
    leftPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    leftPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    leftPanel.spacing = 5;
    gui.addControl(leftPanel);

    const openButton = Button.CreateImageOnlyButton("openBtn", "/assets/open.png");
    styleImageButton(openButton);
    openButton.tooltipText = "Load Published Case";
    openButton.onPointerUpObservable.add(() => document.getElementById('ztcadLoaderInput')?.click());
    leftPanel.addControl(openButton);

    const converterButton = Button.CreateImageOnlyButton("converterBtn", "/assets/tcad_converter.png");
    styleImageButton(converterButton);
    converterButton.tooltipText = "Export Model";
    converterButton.paddingTop = "10px";
    converterButton.onPointerUpObservable.add(() => {
        if (onOpenExportDrawer) onOpenExportDrawer();
    });
    leftPanel.addControl(converterButton);

    return gui;
};

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