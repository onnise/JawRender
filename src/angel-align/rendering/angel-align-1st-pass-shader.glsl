// Vertex shader
#version 300 es
layout(location = 0) in vec3 position;
layout(location = 1) in vec3 normal;

// Babylon.js standard uniforms
uniform mat4 world;
uniform mat4 worldViewProjection;

// Outputs to Fragment Shader
out vec3 v_worldPos;
out vec3 v_normal;

void main() {
    // Transform vertex position to world space
    vec4 worldPos = world * vec4(position, 1.0);
    v_worldPos = worldPos.xyz;

    // Transform normal to world space
    v_normal = normalize(mat3(world) * normal);

    // Project vertex position to clip space
    gl_Position = worldViewProjection * vec4(position, 1.0);
}


// Fragment shader
#version 300 es
precision highp float;

// G-Buffer texture outputs
layout(location = 0) out vec4 gPosition;
layout(location = 1) out vec4 gNormal;
layout (location = 2) out vec4 gColor;

// Inputs from Vertex Shader
in vec3 v_worldPos;
in vec3 v_normal;

void main() {
    // Store world position and normal in the G-Buffer
    gPosition = vec4(v_worldPos, 1.0);
    gNormal = vec4(v_normal, 1.0);

    // Output a simple white color for now.
    // The actual material properties will be handled in the lighting pass.
    gColor = vec4(1.0, 1.0, 1.0, 1.0); 
}