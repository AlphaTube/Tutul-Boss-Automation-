import { GoogleGenAI, Modality, Type } from "@google/genai";
import { VoiceName, TargetLanguage, ScriptStyle } from "./types";

export class GeminiService {
  // Always create a fresh instance to ensure the most up-to-date API key is used
  private getAI() {
    const apiKey = process.env.API_KEY;
    if (!apiKey || apiKey === "undefined" || apiKey.length < 5) {
      throw new Error("INVALID_KEY");
    }
    return new GoogleGenAI({ apiKey });
  }

  isApiKeyConfigured(): boolean {
    const key = process.env.API_KEY;
    return !!key && key !== "undefined" && key.length > 10;
  }

  async generateScriptFromText(
    promptText: string,
    targetLanguage: TargetLanguage,
    style: ScriptStyle,
    isDualVoice: boolean
  ): Promise<{ script: any[], titles: any[] }> {
    const ai = this.getAI();
    const dualVoiceInstruction = isDualVoice ? 
      `DIALOGUE MODE: Create a conversation between 'Speaker 1' and 'Speaker 2'.` : 
      `MONOLOGUE MODE: Assign all lines to 'Speaker 1'.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Generate a script for: "${promptText}". Style: ${style}, Language: ${targetLanguage}. ${dualVoiceInstruction}. Return JSON with "script" (array of {original, rewritten, speaker}) and "titles" (array of {local}).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            script: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  original: { type: Type.STRING },
                  rewritten: { type: Type.STRING },
                  speaker: { type: Type.STRING }
                }
              }
            },
            titles: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  local: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    try {
      return JSON.parse(response.text || '{"script":[], "titles":[]}');
    } catch (e) {
      console.error("Failed to parse JSON response", e);
      return { script: [], titles: [] };
    }
  }

  async processVideoContent(
    videoBase64: string, 
    mimeType: string, 
    targetLanguage: TargetLanguage,
    style: ScriptStyle,
    isDualVoice: boolean
  ): Promise<{ script: any[], titles: any[] }> {
    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            { inlineData: { data: videoBase64, mimeType } },
            { text: `Analyze this video. Translate and rewrite the content into ${targetLanguage} with a ${style} style. ${isDualVoice ? 'Identify two different characters if possible and assign lines as Speaker 1 and Speaker 2' : 'Assign everything to Speaker 1'}. Return JSON.` }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            script: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  original: { type: Type.STRING },
                  rewritten: { type: Type.STRING },
                  speaker: { type: Type.STRING }
                }
              }
            },
            titles: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  local: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    try {
      return JSON.parse(response.text || '{"script":[], "titles":[]}');
    } catch (e) {
      console.error("Failed to parse video response", e);
      return { script: [], titles: [] };
    }
  }

  async generateSpeech(
    lines: { text: string, speaker: string }[], 
    voice1: VoiceName,
    voice2?: VoiceName,
    isDualVoice: boolean = false
  ): Promise<string | undefined> {
    const ai = this.getAI();
    const fullPrompt = lines.map(l => `${l.speaker}: ${l.text}`).join('\n');
    
    const speechConfig: any = {};
    if (isDualVoice && voice2) {
      speechConfig.multiSpeakerVoiceConfig = {
        speakerVoiceConfigs: [
          { speaker: 'Speaker 1', voiceConfig: { prebuiltVoiceConfig: { voiceName: voice1 } } },
          { speaker: 'Speaker 2', voiceConfig: { prebuiltVoiceConfig: { voiceName: voice2 } } },
        ],
      };
    } else {
      speechConfig.voiceConfig = { prebuiltVoiceConfig: { voiceName: voice1 } };
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `TTS this script precisely:\n${fullPrompt}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  }
}

export const geminiService = new GeminiService();

export async function playPcmAudio(base64Data: string) {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  const dataInt16 = new Int16Array(bytes.buffer);
  const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();
}

export function createWavBlob(base64Data: string): Blob {
  const binaryString = atob(base64Data);
  const pcmData = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) pcmData[i] = binaryString.charCodeAt(i);
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  view.setUint32(0, 0x52494646, false); // RIFF
  view.setUint32(4, 36 + pcmData.length, true);
  view.setUint32(8, 0x57415645, false); // WAVE
  view.setUint32(12, 0x666d7420, false); // fmt 
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, 24000, true); // Sample Rate
  view.setUint32(28, 48000, true); // Byte Rate
  view.setUint16(32, 2, true); // Block Align
  view.setUint16(34, 16, true); // Bits per sample
  view.setUint32(36, 0x64617461, false); // data
  view.setUint32(40, pcmData.length, true);
  return new Blob([header, pcmData], { type: 'audio/wav' });
}