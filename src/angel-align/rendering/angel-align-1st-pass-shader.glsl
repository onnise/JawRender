// Vertex shader
#version 300 es
layout(location = 0) in vec3 VertexPosition;
layout(location = 1) in vec3 VertexNormal;
out vec4 ECPosition;
out vec3 ECNormal;
out float ClipDistance;
uniform mat4 ModelMatrix;
uniform mat4 ModelViewMatrix;
uniform mat3 NormalMatrix;
uniform mat4 MVP;
uniform float GeometryType;
uniform bool EnableClipPlane;
uniform vec4 ClipPlane;
void main() {
    ECNormal = NormalMatrix * VertexNormal;
    ECPosition = ModelViewMatrix * vec4(VertexPosition, 1.0);
    ECPosition.w = GeometryType;
    ClipDistance = 1.0;
    if (EnableClipPlane) {
        vec4 ModelCoordVertex = ModelMatrix*vec4(VertexPosition, 1.0);
        ClipDistance = dot(ClipPlane, ModelCoordVertex);
    }
    gl_Position = MVP * vec4(VertexPosition, 1.0);
}


// Fragment shader
#version 300 es
precision highp float;
layout(location = 0) out vec4 gPosition;
layout(location = 1) out vec4 gNormal;
layout (location = 2) out vec4 gColor;
in vec4 ECPosition;
in vec3 ECNormal;
in float ClipDistance;
void main() {
    if (ClipDistance < 0.0)                                          
    discard;
    gPosition = ECPosition;
    gNormal = vec4(normalize(ECNormal), 1.0);
    // Output the GeometryType in the red channel
    gColor = vec4(ECPosition.w, 0.0, 0.0, 1.0);
}

