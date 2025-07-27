/**
 * A more robust parser for unified GLSL files that contain vertex and fragment shaders.
 * It uses regular expressions to be insensitive to whitespace and case.
 * @param {string} rawShaderCode The full text content of the .glsl file.
 * @returns {{vertex: string, fragment:string} | null} An object with the code or null on error.
 */
export const parseShaderFile = (rawShaderCode) => {
    // This regular expression finds "//" followed by any spaces,
    // then "vertex" or "fragment" (case-insensitive), any spaces, and then "shader".
    const vertexRegex = /\/\/\s*vertex\s*shader/i;
    const fragmentRegex = /\/\/\s*fragment\s*shader/i;

    const vertexMatch = rawShaderCode.match(vertexRegex);
    const fragmentMatch = rawShaderCode.match(fragmentRegex);

    if (!vertexMatch || !fragmentMatch) {
        console.error("Could not find '// vertex shader' and '// fragment shader' comment markers. The parser failed.", { rawShaderCode });
        return null;
    }

    // The start of the actual code is *after* the full matched comment line.
    const vertexCodeStart = vertexMatch.index + vertexMatch[0].length;
    const fragmentCodeStart = fragmentMatch.index + fragmentMatch[0].length;

    // The end of the vertex shader is the beginning of the fragment shader's comment marker.
    const vertexCodeEnd = fragmentMatch.index;

    const vertexShader = rawShaderCode
        .substring(vertexCodeStart, vertexCodeEnd)
        .trim();

    const fragmentShader = rawShaderCode
        .substring(fragmentCodeStart)
        .trim();

    if (!vertexShader || !fragmentShader) {
        console.error("Robust shader parsing resulted in an empty vertex or fragment shader string.");
        return null;
    }

    // Add a final sanity check to make sure the fragment part is plausible.
    if (!fragmentShader.includes("main")) {
        console.error("SHADER PARSING FAILURE: The parsed fragment shader is missing a 'main()' function. This indicates the split was incorrect.", { fragmentShader });
        return null;
    }

    return { vertex: vertexShader, fragment: fragmentShader };
};