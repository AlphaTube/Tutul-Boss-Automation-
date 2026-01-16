
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { VoiceName, TargetLanguage, ScriptStyle } from "./types";

// Vercel extracts this from Environment Variables
const API_KEY = process.env.API_KEY || '';

export class GeminiService {
  private ai: GoogleGenAI | null = null;

  constructor() {
    if (API_KEY) {
      this.ai = new GoogleGenAI({ apiKey: API_KEY });
    }
  }

  // Check if API key exists and is likely valid
  isApiKeyConfigured(): boolean {
    return API_KEY.length > 10;
  }

  getApiKeyPreview(): string {
    if (!API_KEY) return "Missing";
    return `${API_KEY.substring(0, 4)}...${API_KEY.substring(API_KEY.length - 4)}`;
  }

  private getAI() {
    if (!this.ai) {
      if (API_KEY) {
        this.ai = new GoogleGenAI({ apiKey: API_KEY });
        return this.ai;
      }
      throw new Error("API Key is missing. Please check your Vercel Environment Variables.");
    }
    return this.ai;
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
      contents: `Generate a script for: "${promptText}". Style: ${style}, Language: ${targetLanguage}. ${dualVoiceInstruction}. Return JSON with "script" (original, rewritten, speaker) and "titles" (local).`,
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
            { text: `Watch this video. Rewrite the transcript into ${targetLanguage} in a ${style} style. ${isDualVoice ? 'Split between two speakers' : 'Single speaker'}. Return JSON with "script" and "titles".` }
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
    const fullText = lines.map(l => `${l.speaker}: ${l.text}`).join('\n');
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Generate audio for: ${fullText}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: isDualVoice && voice2 ? {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              { speaker: 'Speaker 1', voiceConfig: { prebuiltVoiceConfig: { voiceName: voice1 } } },
              { speaker: 'Speaker 2', voiceConfig: { prebuiltVoiceConfig: { voiceName: voice2 } } },
            ],
          },
        } : {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voice1 } }
        }
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
  view.setUint32(0, 0x52494646, false);
  view.setUint32(4, 36 + pcmData.length, true);
  view.setUint32(8, 0x57415645, false);
  view.setUint32(12, 0x666d7420, false);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 24000, true);
  view.setUint32(28, 48000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461, false);
  view.setUint32(40, pcmData.length, true);
  return new Blob([header, pcmData], { type: 'audio/wav' });
}
