// Vertex
#version 100
attribute vec3 VertexPosition;
attribute vec2 VertexTexCoord;
attribute vec4 VertexColor;
varying vec3 LocalPosition;
varying vec2 TexCoord;
varying vec4 Color;
uniform mat4 MVP;
void main() {
    TexCoord = VertexTexCoord;
    LocalPosition = VertexPosition;
    Color = VertexColor;
    gl_Position = MVP * vec4(VertexPosition, 1.0);
}


// Fragment
#version 100
precision highp float;
varying vec3 LocalPosition;
varying vec2 TexCoord;
varying vec4 Color;
uniform bool EnableTexture;
uniform sampler2D Texture;
uniform sampler2D SwellShadowTexture;
uniform vec4 TextureBackgroundColor;
uniform vec4 Viewport;
uniform vec3 ShadowColor;
uniform bool EnableSwellShadow;
float GetAlpha_Ellipse() {
    float fStartPosX = float(Viewport[0]);
    float fStartPosY = float(Viewport[1]);
    float fWidth = float(Viewport[2]);
    float fHeight = float(Viewport[3]);
    float fRight = fStartPosX + fWidth;
    float fBottom = fStartPosY + fHeight;
    vec2 center = vec2((fStartPosX+fRight)*0.5, (fStartPosY+fBottom)*0.5);
    vec2 pos = LocalPosition.xy - center;
    float fEccentricity = 0.618034005;
    float fRadioAB = 0.786151350;
    float fA = 1.0;
    float fB = 1.0;
    float fC = 1.0;
    if (fWidth >= fWidth) {
        fA = fWidth*0.5*0.9;
        fB = fRadioAB*fA;
        fC = fEccentricity*fA;
    }
    else {
        fB = fHeight*0.5*0.9;
        fA = fB / fRadioAB;
        fC = fEccentricity*fA;
    }
    float fDisC1 = sqrt((pos.x + fC)*(pos.x + fC) + pos.y*pos.y);
    float fDisC2 = sqrt((pos.x - fC)*(pos.x - fC) + pos.y*pos.y);
    float fAlpha = (2.0*fA - fDisC1 - fDisC2) / (1.1*fA);
    return fAlpha;
}
void main() {
    if (gl_FrontFacing) {
        vec2 coord = (gl_FragCoord.xy - Viewport.xy) / Viewport.zw;
        float fWeight = texture2D(SwellShadowTexture, coord).r;
        if(EnableTexture) {
            float fAlpha = GetAlpha_Ellipse();
            vec4 VertexColor = texture2D(Texture, TexCoord);
            vec3 BlendColor = fAlpha*VertexColor.xyz + (1.0-fAlpha)*TextureBackgroundColor.xyz;
            if (EnableSwellShadow)
            gl_FragColor = vec4(BlendColor.xyz, 1.0)* fWeight + (1.0 - fWeight)* vec4(ShadowColor, 1.0);
            else
            gl_FragColor = vec4(BlendColor, 1.0);
        }
        else {
            if (EnableSwellShadow)
            gl_FragColor = Color * fWeight + (1.0 - fWeight)* vec4(ShadowColor, 1.0);
            else
            gl_FragColor = Color;
        }

    }

}
