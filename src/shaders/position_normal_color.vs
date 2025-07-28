precision highp float;


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
