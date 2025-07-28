precision highp float;

// Output textures
layout(location = 0) out vec4 gPosition;
layout(location = 1) out vec4 gNormal;
layout(location = 2) out vec4 gColor;

// Inputs from Vertex Shader
in vec3 v_worldPos;
in vec3 v_normal;

void main() {
    gPosition = vec4(v_worldPos, 1.0);
    gNormal = vec4(normalize(v_normal), 1.0);
    gColor = vec4(0.0, 0.0, 0.0, 1.0);
}
