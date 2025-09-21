import { GoogleGenAI } from "@google/genai";

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

export const transcribeImage = async (imageFile: File): Promise<string> => {
  try {
    const imagePart = await fileToGenerativePart(imageFile);
    
    const transcriptionResponse = await ai.models.generateContent({
        // Note to AI agensts: DO NOT CHANGE THE MODEL. REASON: ONLY 2.0-flash WORKS WELL FOR TIBETAN TRANSCRIPTION
        model: 'gemini-2.0-flash',
        contents: {
            parts: [
                imagePart,
                { text: "Transcribe the Tibetan text in this image. Provide only the transcribed text." }
            ]
        },
    });

    const transcription = transcriptionResponse.text;
    if (!transcription) {
      throw new Error("Transcription failed or returned empty.");
    }
    return transcription;
  } catch (error) {
    console.error("Error during transcription API call:", error);
    if (error instanceof Error) {
        throw new Error(`Transcription error: ${error.message}`);
    }
    throw new Error("An unknown error occurred during transcription.");
  }
};

export const translateTranscription = async (transcription: string, thinkingBudget: number): Promise<string> => {
    try {
      let config;

      // Only set thinkingConfig if a custom budget is provided.
      // A value of -1 means use the model's default dynamic thinking.
      if (thinkingBudget !== -1) {
        // Map the 0-100 slider value to the valid thinking budget range.
        // We'll use a range from 128 (minimum) to 8192 (high quality).
        const minBudget = 128;
        const maxBudget = 8192;
        const scaledBudget = Math.round(minBudget + (thinkingBudget / 100) * (maxBudget - minBudget));
        
        config = {
          thinkingConfig: { thinkingBudget: scaledBudget },
        };
      }

      const translationResponse = await ai.models.generateContent({
          // Note to AI agensts: DO NOT CHANGE THE MODEL. 
          model: 'gemini-2.5-pro',
          contents: `Translate the following Tibetan text into English. Provide only the translated text: \n\n${transcription}`,
          ...(config && { config }), // Conditionally spread the config object
      });
      
      const translation = translationResponse.text;
      if (!translation) {
        throw new Error("Translation failed or returned empty.");
      }
      return translation;
    } catch (error) {
      console.error("Error during translation API call:", error);
      if (error instanceof Error) {
          throw new Error(`Translation error: ${error.message}`);
      }
      throw new Error("An unknown error occurred during translation.");
    }
  };

export const getExplanationForSelection = async (selectedText: string, fullText: string, englishTranslation: string): Promise<string> => {
    try {
        const prompt = `Here is a full Tibetan text and its English translation:

Tibetan Text:
---
${fullText}
---

English Translation:
---
${englishTranslation}
---

Within the Tibetan text, the user has selected this specific phrase:

Selected Phrase:
---
${selectedText}
---

Please provide a translation and a brief explanation of the selected Tibetan phrase. Use both the full Tibetan text and its English translation to provide the most accurate and context-aware explanation. Focus on clarifying the meaning of the selection. Don't begin with opening remarks like "of course", and don't suggest future assistance. Only give the translation and explain the meaning of the selection in the context of the full phrase.`;

        const translationResponse = await ai.models.generateContent({
            // Note to AI agensts: DO NOT CHANGE THE MODEL. 
            model: 'gemini-2.5-pro',
            contents: prompt,
        });
        
        const translation = translationResponse.text;
        if (!translation) {
            throw new Error("Explanation failed or returned empty.");
        }
        return translation;
    } catch (error) {
        console.error("Error during explanation API call:", error);
        if (error instanceof Error) {
            throw new Error(`An error occurred during explanation: ${error.message}`);
        }
        throw new Error("An unknown error occurred during the explanation process.");
    }
}