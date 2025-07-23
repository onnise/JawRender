// Vertex
#version 100
attribute vec3 VertexPosition;
varying float ClipDistance;
uniform mat4 ModelMatrix;
uniform mat4 MVP;
uniform bool EnableClipPlane;
uniform vec4 ClipPlane;
void main() {
    ClipDistance = 1.0;
    if (EnableClipPlane) {
        vec4 ModelCoordVertex = ModelMatrix*vec4(VertexPosition, 1.0);
        ClipDistance = dot(ClipPlane, ModelCoordVertex);
    }
    gl_Position = MVP * vec4(VertexPosition, 1.0);
}


// Fragment
#version 100
precision highp float;
varying float ClipDistance;
uniform bool OutputDepth;
uniform vec4 VertexColor;
void main() {
    if (ClipDistance < 0.0)                                                       
    discard;
    if (OutputDepth) {
        float fDepth = gl_FragCoord.z;
        int R = int(fDepth * 10.0);
        int G = int(fDepth * 1000.0);
        int B = int(fDepth * 100000.0);
        int A = int(fDepth * 10000000.0);
        G = G - 100 * int(G / 100);
        B = B - 100 * int(B / 100);
        A = A - 100 * int(A / 100);
        gl_FragColor = vec4(float(R) * 0.1, float(G) * 0.01, float(B) * 0.01, float(A) * 0.01);
    }
    else                                                                          
    gl_FragColor = VertexColor;
}
