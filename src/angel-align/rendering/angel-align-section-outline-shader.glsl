// Vertex
#version 100
attribute vec3 VertexPosition;
varying vec3 LocalPosition;
uniform mat4 MVP;
void main() {
    LocalPosition = VertexPosition;
    gl_Position = MVP * vec4(VertexPosition, 1.0);
}



// Fragment
#version 100
precision highp float;
varying vec3 LocalPosition;
uniform vec4 VertexColor;
uniform bool IPRLine;
uniform mat4 ModelViewMatrix;
uniform mat4 ProjectionMatrix;
uniform float ViewPort[4];
uniform vec2 RectPoint[4];
uniform bool LeftTopZero;
uniform bool Perspective;
bool IsInQuad(vec2 PointOnPlane) {
    float a = (RectPoint[1].x - RectPoint[0].x)*(PointOnPlane.y - RectPoint[0].y) - (RectPoint[1].y - RectPoint[0].y)*(PointOnPlane.x - RectPoint[0].x);
    float b = (RectPoint[2].x - RectPoint[1].x)*(PointOnPlane.y - RectPoint[1].y) - (RectPoint[2].y - RectPoint[1].y)*(PointOnPlane.x - RectPoint[1].x);
    float c = (RectPoint[3].x - RectPoint[2].x)*(PointOnPlane.y - RectPoint[2].y) - (RectPoint[3].y - RectPoint[2].y)*(PointOnPlane.x - RectPoint[2].x);
    float d = (RectPoint[0].x - RectPoint[3].x)*(PointOnPlane.y - RectPoint[3].y) - (RectPoint[0].y - RectPoint[3].y)*(PointOnPlane.x - RectPoint[3].x);
    if ((a > 0.0 && b > 0.0 && c > 0.0 && d > 0.0) || (a < 0.0 && b < 0.0 && c < 0.0 && d < 0.0))
    return true;
    return false;
}
vec2 GLProjection(vec3 pos) {
    vec2 posOnScreen = vec2(0.0, 0.0);
    float fTempo[8];
    fTempo[0] = ModelViewMatrix[0][0] * pos.x + ModelViewMatrix[1][0] * pos.y + ModelViewMatrix[2][0] * pos.z + ModelViewMatrix[3][0];
    fTempo[1] = ModelViewMatrix[0][1] * pos.x + ModelViewMatrix[1][1] * pos.y + ModelViewMatrix[2][1] * pos.z + ModelViewMatrix[3][1];
    fTempo[2] = ModelViewMatrix[0][2] * pos.x + ModelViewMatrix[1][2] * pos.y + ModelViewMatrix[2][2] * pos.z + ModelViewMatrix[3][2];
    fTempo[3] = ModelViewMatrix[0][3] * pos.x + ModelViewMatrix[1][3] * pos.y + ModelViewMatrix[2][3] * pos.z + ModelViewMatrix[3][3];
    fTempo[4] = ProjectionMatrix[0][0] * fTempo[0] + ProjectionMatrix[1][0] * fTempo[1] + ProjectionMatrix[2][0] * fTempo[2] + ProjectionMatrix[3][0] * fTempo[3];
    fTempo[5] = ProjectionMatrix[0][1] * fTempo[0] + ProjectionMatrix[1][1] * fTempo[1] + ProjectionMatrix[2][1] * fTempo[2] + ProjectionMatrix[3][1] * fTempo[3];
    fTempo[6] = ProjectionMatrix[0][2] * fTempo[0] + ProjectionMatrix[1][2] * fTempo[1] + ProjectionMatrix[2][2] * fTempo[2] + ProjectionMatrix[3][2] * fTempo[3];
    fTempo[7] = -fTempo[2];
    if (fTempo[7] == 0.0)
    return posOnScreen;
    fTempo[7] = 1.0 / fTempo[7];
    if (Perspective) {
        fTempo[4] *= fTempo[7];
        fTempo[5] *= fTempo[7];
        fTempo[6] *= fTempo[7];
    }
    posOnScreen.x = (fTempo[4] * 0.5 + 0.5)*ViewPort[2] + ViewPort[0];
    posOnScreen.y = (fTempo[5] * 0.5 + 0.5)*ViewPort[3] + ViewPort[1];
    if (LeftTopZero)
    posOnScreen.y = ViewPort[3] - ViewPort[1] - posOnScreen.y;
    float fDepth = (1.0 + fTempo[6])*0.5;
    return posOnScreen;
}
void main() {
    if (gl_FrontFacing) {
        if (IPRLine) {
            vec2 ScreenPosition = GLProjection(LocalPosition);
            if (IsInQuad(ScreenPosition))
            discard;
            else
            gl_FragColor = VertexColor;
        }
        else
        gl_FragColor = VertexColor;
    }

}
