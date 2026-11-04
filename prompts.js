export const PROMPTS = {
    mainScene: (sceneDescription, attempt) => {
        if (attempt === 1) {
            return `2D cartoon style, exact SpongeBob SquarePants art style. Underwater Bikini Bottom. Action: ${sceneDescription}`;
        }
        return `2D cartoon, underwater scene. Action: ${sceneDescription}`;
    },

    character: (characterName, sceneDescription, attempt) => {
        if (attempt === 1) {
            return `2D cartoon style, SpongeBob character ${characterName}. Change pose and facial expression to: ${sceneDescription}. White background.`;
        }
        return `A cute 2D cartoon character illustration, flat colors, thick outlines. The character is reacting to this situation: "${sceneDescription}". Kid-friendly drawing, simple white background.`;
    }
};