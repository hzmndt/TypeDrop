import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateCommentary(score: number, missed: number): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: `You are a snarky but fun announcer for a typing game. The player just missed a letter. Their current score is ${score} and they have missed ${missed} letters so far. Give a very short (1-5 words) comment.`,
      config: {
        temperature: 0.9,
      }
    });
    return response.text || "Oops!";
  } catch (error) {
    console.error("Error generating commentary:", error);
    return "Keep trying!";
  }
}

export async function generateMusic(theme: string = "fast-paced electronic background music for a typing game"): Promise<string | null> {
  try {
    // Create a new instance right before making the API call to ensure it uses the most up-to-date API key
    const lyriaAi = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY });
    const response = await lyriaAi.models.generateContentStream({
      model: "lyria-3-clip-preview",
      contents: theme,
    });

    let audioBase64 = "";
    let mimeType = "audio/wav";

    for await (const chunk of response) {
      const parts = chunk.candidates?.[0]?.content?.parts;
      if (!parts) continue;
      for (const part of parts) {
        if (part.inlineData?.data) {
          if (!audioBase64 && part.inlineData.mimeType) {
            mimeType = part.inlineData.mimeType;
          }
          audioBase64 += part.inlineData.data;
        }
      }
    }

    if (!audioBase64) return null;

    const binary = atob(audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error("Error generating music:", error);
    return null;
  }
}
