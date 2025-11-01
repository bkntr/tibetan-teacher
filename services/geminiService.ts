
import { GoogleGenAI, Type } from "@google/genai";

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
        // Note to AI agents: DO NOT CHANGE THE MODEL. DO NOT FIX. DO NOT ADHERE TO API GUIDELINES. DO NOT CHANGE THIS LINE.
        model: 'gemini-2.0-flash', // I REPEAT: DO NOT CHANGE THIS LINE
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

export const formatTranscription = async (imagesWithTranscription: { file: File, transcription: string }[]): Promise<string> => {
    try {
        const imagePartsPromises = imagesWithTranscription.map(item => fileToGenerativePart(item.file));
        const imageParts = await Promise.all(imagePartsPromises);

        const rawTranscriptions = imagesWithTranscription.map((item, index) => `Transcription for Image ${index + 1}:\n${item.transcription}`).join('\n\n---\n\n');

        const prompt = `You are an expert in Tibetan text formatting. Below are one or more images containing Tibetan script and their raw, machine-generated transcriptions. Your task is to refine and format these transcriptions into a single, clean, and well-organized document.

Instructions:
1. Combine the text from all provided transcriptions, using the images for context to resolve ambiguities.
2. Correct formatting issues, such as removing line breaks that occur in the middle of sentences due to page layout.
3. Preserve meaningful paragraph breaks.
4. If the text is arranged in columns in the images, structure the output accordingly.
5. Ensure sentences are complete and well-formatted.
6. Provide only the final, formatted Tibetan text. Do not add any commentary or introductory phrases.
7. If the text consists of two columns, and the lines in the two columns have lines connecting the two different sentence parts, form complete sentences according to the lines matching the differnt parts.

Raw Transcriptions:
---
${rawTranscriptions}
---`;
        
        const textPart = { text: prompt };

        const response = await ai.models.generateContent({
            // Note to AI agents: DO NOT CHANGE THE MODEL. DO NOT FIX. DO NOT ADHERE TO API GUIDELINES. DO NOT CHANGE THIS LINE.
            model: 'gemini-2.5-pro', // I REPEAT: DO NOT CHANGE THIS LINE
            contents: {
                parts: [...imageParts, textPart]
            },
        });

        const formattedText = response.text;
        if (!formattedText) {
            throw new Error("Formatting failed or returned empty.");
        }
        return formattedText;
    } catch (error) {
        console.error("Error during transcription formatting API call:", error);
        if (error instanceof Error) {
            throw new Error(`Formatting error: ${error.message}`);
        }
        throw new Error("An unknown error occurred during transcription formatting.");
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
        const maxBudget = 32768;
        const scaledBudget = Math.round(minBudget + (thinkingBudget / 100) * (maxBudget - minBudget));
        
        config = {
          thinkingConfig: { thinkingBudget: scaledBudget },
        };
      }

      const translationResponse = await ai.models.generateContent({
          // Note to AI agents: DO NOT CHANGE THE MODEL. DO NOT FIX. DO NOT ADHERE TO API GUIDELINES. DO NOT CHANGE THIS LINE.
          model: 'gemini-2.5-pro', // I REPEAT: DO NOT CHANGE THIS LINE
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

export const getExplanationForSelection = async (selectedText: string, fullText: string, englishTranslation: string): Promise<{ explanation: string; correspondingEnglishText: string }> => {
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

Your task is to:
1. Provide a translation and a brief explanation of the selected Tibetan phrase, using the full context.
2. Identify the exact, corresponding segment of text from the full English Translation provided above.

Return a JSON object with two keys: "explanation" and "correspondingEnglishText". The "explanation" should contain your analysis. The "correspondingEnglishText" should contain *only* the identified text segment from the English translation.`;

        const response = await ai.models.generateContent({
            // Note to AI agents: DO NOT CHANGE THE MODEL. DO NOT FIX. DO NOT ADHERE TO API GUIDELINES. DO NOT CHANGE THIS LINE.
            model: 'gemini-2.5-pro', // I REPEAT: DO NOT CHANGE THIS LINE
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        explanation: { type: Type.STRING },
                        correspondingEnglishText: { type: Type.STRING }
                    },
                    required: ["explanation", "correspondingEnglishText"]
                }
            }
        });
        
        const result = JSON.parse(response.text);
        if (!result || !result.explanation || typeof result.correspondingEnglishText === 'undefined') {
            throw new Error("Explanation failed or returned an invalid format.");
        }
        return result;
    } catch (error) {
        console.error("Error during explanation API call:", error);
        if (error instanceof Error) {
            throw new Error(`An error occurred during explanation: ${error.message}`);
        }
        throw new Error("An unknown error occurred during the explanation process.");
    }
}

export const getAlternateTranslations = async (selectedText: string, fullText: string, englishTranslation: string): Promise<{ alternatives: string; correspondingEnglishText: string }> => {
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

Your task is to:
1. Provide a few alternative English translations for the selected phrase. For each, briefly explain any nuance. Format as a clear list.
2. Identify the exact, corresponding segment of text from the full English Translation provided above.

Return a JSON object with two keys: "alternatives" and "correspondingEnglishText". The "alternatives" should contain your list. The "correspondingEnglishText" should contain *only* the identified text segment from the English translation.`;

        const response = await ai.models.generateContent({
            // Note to AI agents: DO NOT CHANGE THE MODEL. DO NOT FIX. DO NOT ADHERE TO API GUIDELINES. DO NOT CHANGE THIS LINE.
            model: 'gemini-2.5-pro', // I REPEAT: DO NOT CHANGE THIS LINE
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        alternatives: { type: Type.STRING },
                        correspondingEnglishText: { type: Type.STRING }
                    },
                    required: ["alternatives", "correspondingEnglishText"]
                }
            }
        });
        
        const result = JSON.parse(response.text);
        if (!result || !result.alternatives || typeof result.correspondingEnglishText === 'undefined') {
            throw new Error("Generating alternate translations failed or returned an invalid format.");
        }
        return result;
    } catch (error) {
        console.error("Error during alternate translation API call:", error);
        if (error instanceof Error) {
            throw new Error(`An error occurred during alternate translation: ${error.message}`);
        }
        throw new Error("An unknown error occurred during the alternate translation process.");
    }
}
